use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tokio::sync::broadcast;

/// Upper bound a waiter will wait for an in-flight computation before giving up
/// and (re)entering the audit loop. Prevents permanently hanging IPC calls.
pub const WAIT_LIMIT: Duration = Duration::from_secs(150);

/// A `Running` session older than this is considered stale (e.g. the compute
/// task died before sending), so new callers start a fresh computation.
const RUNNING_STALE: Duration = Duration::from_secs(300);

enum State<T> {
    /// Cached value + when it was produced.
    Idle { produced: Option<(Instant, T)> },
    /// A computation is in-flight; waiters subscribe to the broadcast sender.
    Running {
        started: Instant,
        tx: broadcast::Sender<Result<T, String>>,
    },
}

struct Inner<T> {
    state: Mutex<State<T>>,
}

/// Single-flight cache coordinating tag computes and wakes all waiters via a
/// shared, cloneable broadcast receiver. The internal `Mutex` is only ever
/// held for a few instructions to read/claim the slot — never across an await
/// point — so the async runtime is never blocked by it. The expensive work
/// itself always runs in `tokio::task::spawn_blocking`.
pub struct Client<T> {
    inner: Arc<Inner<T>>,
}

impl<T> Client<T> {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Inner {
                state: Mutex::new(State::Idle { produced: None }),
            }),
        }
    }
}

impl<T: Clone + Send + 'static> Client<T> {
    /// Sync write path for non-async threads (background pre-warmer, metrics
    /// loop). Replaces/sets the cached value; cheap lock, no await.
    pub fn push(&self, value: T) {
        let mut st = self.inner.state.lock().unwrap();
        *st = State::Idle {
            produced: Some((Instant::now(), value)),
        };
    }

    /// Best-effort read of the current cached value (no computation started).
    pub fn cached(&self) -> Option<T> {
        let st = self.inner.state.lock().unwrap();
        match &*st {
            State::Idle {
                produced: Some((_, v)),
            } => Some(v.clone()),
            _ => None,
        }
    }

    /// Resolve a value with single-flight coalescing.
    ///
    /// * `ttl`  – `Some(d)` means a produced value younger than `d` is reused,
    ///            `None` means a cached value never expires on its own.
    /// * `bust` – force recompute even if a fresh cached value exists (but a
    ///            running computation is still joined, never duplicated).
    /// * `compute` – sync/blocking producer (PS spawn etc.); executed at most
    ///               once per wave, on a `spawn_blocking` worker.
    pub async fn get<F>(&self, ttl: Option<Duration>, bust: bool, compute: F) -> Result<T, String>
    where
        F: FnOnce() -> Result<T, String> + Send + 'static,
    {
        let mut compute = Some(compute);
        loop {
            enum Step<T2> {
                Cached(T2),
                Join(broadcast::Receiver<Result<T2, String>>),
                Claim(broadcast::Sender<Result<T2, String>>),
            }
            let step = {
                let mut st = self.inner.state.lock().unwrap();
                match &*st {
                    State::Running { started, tx } if started.elapsed() < RUNNING_STALE => {
                        Step::Join(tx.subscribe())
                    }
                    State::Idle {
                        produced: Some((at, v)),
                    } if !bust && ttl.map_or(true, |d| at.elapsed() < d) => Step::Cached(v.clone()),
                    _ => {
                        let (tx, _) = broadcast::channel(1);
                        *st = State::Running {
                            started: Instant::now(),
                            tx: tx.clone(),
                        };
                        Step::Claim(tx)
                    }
                }
            };

            let mut rx = match step {
                Step::Cached(v) => return Ok(v),
                Step::Join(rx) => rx,
                Step::Claim(tx) => {
                    // This caller owns the wave: launch the producer exactly once.
                    if let Some(c) = compute.take() {
                        let inner = self.inner.clone();
                        let tx2 = tx.clone();
                        tokio::task::spawn_blocking(move || {
                            let res = c();
                            if let Ok(ref v) = res {
                                let mut st = inner.state.lock().unwrap();
                                *st = State::Idle {
                                    produced: Some((Instant::now(), v.clone())),
                                };
                            }
                            let _ = tx2.send(res);
                        });
                    }
                    tx.subscribe()
                }
            };

            match tokio::time::timeout(WAIT_LIMIT, rx.recv()).await {
                Ok(Ok(Ok(v))) => return Ok(v),
                Ok(Ok(Err(e))) => return Err(e),
                // Timeout or lagged: re-enter the audit loop. The producer may
                // have already stored a value, or the slot is stale and a new
                // wave will be claimed.
                _ => continue,
            }
        }
    }
}

impl<T> Default for Client<T> {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;

    #[tokio::test]
    async fn coalesces_concurrent_getters() {
        let client = Client::<u32>::new();
        let calls = Arc::new(AtomicUsize::new(0));
        let gate = Arc::new(client);

        let mut handles = Vec::new();
        for _ in 0..5 {
            let gate = gate.clone();
            let calls = calls.clone();
            handles.push(tokio::spawn(async move {
                gate.get(None, false, move || {
                    calls.fetch_add(1, Ordering::SeqCst);
                    std::thread::sleep(Duration::from_millis(120));
                    Ok(42u32)
                })
                .await
            }));
        }
        for h in handles {
            assert_eq!(h.await.unwrap().unwrap(), 42);
        }
        assert_eq!(calls.load(Ordering::SeqCst), 1, "compute must run once");
    }

    #[tokio::test]
    async fn serves_cache_after_compute() {
        let client = Client::<String>::new();
        assert_eq!(client.get(None, false, || Ok("a".into())).await.unwrap(), "a");
        // Cached (ttl None => never expires): compute must NOT run again.
        let called = Arc::new(AtomicUsize::new(0));
        let c2 = called.clone();
        let r = client
            .get(None, false, move || {
                c2.fetch_add(1, Ordering::SeqCst);
                Ok("b".into())
            })
            .await
            .unwrap();
        assert_eq!(r, "a");
        assert_eq!(called.load(Ordering::SeqCst), 0);
    }

    #[tokio::test]
    async fn bust_forces_refresh() {
        let client = Client::<u64>::new();
        assert_eq!(client.get(None, false, || Ok(1u64)).await.unwrap(), 1);
        assert_eq!(client.get(None, true, || Ok(2u64)).await.unwrap(), 2);
    }

    #[tokio::test]
    async fn ttl_expiry_recomputes() {
        let client = Client::<u64>::new();
        let ttl = Some(Duration::from_millis(40));
        assert_eq!(client.get(ttl, false, || Ok(1u64)).await.unwrap(), 1);
        tokio::time::sleep(Duration::from_millis(80)).await;
        assert_eq!(client.get(ttl, false, || Ok(9u64)).await.unwrap(), 9);
    }

    #[test]
    fn push_is_visible_to_cached() {
        let client = Client::<u64>::new();
        client.push(77);
        assert_eq!(client.cached(), Some(77));
    }
}