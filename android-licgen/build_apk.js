const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT = path.resolve('c:/Users/PC/Downloads/ThienPhatTechToolKit-Tauri/android-licgen');
const SDK = 'C:/Users/PC/AppData/Local/Android/Sdk';
const BUILD_TOOLS = path.join(SDK, 'build-tools/35.0.0');
const PLATFORM = path.join(SDK, 'platforms/android-35/android.jar');
const JAVA_BIN = 'C:/Program Files/Android/Android Studio/jbr/bin';

const AAPT2 = path.join(BUILD_TOOLS, 'aapt2.exe');
const D8 = path.join(BUILD_TOOLS, 'd8.bat');
const ZIPALIGN = path.join(BUILD_TOOLS, 'zipalign.exe');
const APKSIGNER = path.join(BUILD_TOOLS, 'apksigner.bat');
const JAVAC = path.join(JAVA_BIN, 'javac.exe');
const JAR = path.join(JAVA_BIN, 'jar.exe');
const KEYTOOL = path.join(JAVA_BIN, 'keytool.exe');

const JAVA_HOME = 'C:/Program Files/Android/Android Studio/jbr';
process.env.JAVA_HOME = JAVA_HOME;
process.env.PATH = path.join(JAVA_HOME, 'bin') + path.delimiter + process.env.PATH;

function run(cmd, cwd = PROJECT) {
    console.log('[RUN]', cmd);
    execSync(cmd, { cwd, stdio: 'inherit', env: process.env });
}

try {
    console.log('--- STEP 1: Compiling resources with AAPT2 ---');
    const compiledRes = path.join(PROJECT, 'compiled_res.zip');
    if (fs.existsSync(compiledRes)) fs.unlinkSync(compiledRes);
    run(`"${AAPT2}" compile --dir res -o "${compiledRes}"`);

    console.log('--- STEP 2: Linking resources and generating R.java & unaligned.apk ---');
    const unalignedApk = path.join(PROJECT, 'unaligned.apk');
    if (fs.existsSync(unalignedApk)) fs.unlinkSync(unalignedApk);
    run(`"${AAPT2}" link -I "${PLATFORM}" --manifest AndroidManifest.xml -o "${unalignedApk}" -A assets "${compiledRes}" --java src`);

    console.log('--- STEP 3: Compiling Java classes ---');
    const objDir = path.join(PROJECT, 'obj');
    if (fs.existsSync(objDir)) fs.rmSync(objDir, { recursive: true, force: true });
    fs.mkdirSync(objDir, { recursive: true });

    // Collect all .java files
    function findJava(dir, list = []) {
        for (const item of fs.readdirSync(dir)) {
            const full = path.join(dir, item);
            if (fs.statSync(full).isDirectory()) findJava(full, list);
            else if (full.endsWith('.java')) list.push(full);
        }
        return list;
    }
    const javaFiles = findJava(path.join(PROJECT, 'src'));
    run(`"${JAVAC}" -encoding UTF-8 -cp "${PLATFORM}" -d "${objDir}" ${javaFiles.map(f => `"${f}"`).join(' ')}`);

    console.log('--- STEP 4: Generating classes.dex with D8 ---');
    function findClass(dir, list = []) {
        for (const item of fs.readdirSync(dir)) {
            const full = path.join(dir, item);
            if (fs.statSync(full).isDirectory()) findClass(full, list);
            else if (full.endsWith('.class')) list.push(full);
        }
        return list;
    }
    const classFiles = findClass(objDir);
    const classesDex = path.join(PROJECT, 'classes.dex');
    if (fs.existsSync(classesDex)) fs.unlinkSync(classesDex);
    run(`cmd.exe /c ""${D8}" --lib "${PLATFORM}" --output . ${classFiles.map(f => `"${f}"`).join(' ')}"`);

    console.log('--- STEP 5: Adding classes.dex to unaligned.apk ---');
    run(`"${JAR}" uf "${unalignedApk}" classes.dex`);

    console.log('--- STEP 6: Zipalign APK ---');
    const alignedApk = path.join(PROJECT, 'aligned.apk');
    if (fs.existsSync(alignedApk)) fs.unlinkSync(alignedApk);
    run(`"${ZIPALIGN}" -f -p 4 "${unalignedApk}" "${alignedApk}"`);

    console.log('--- STEP 7: Keystore check ---');
    const keystore = path.join(PROJECT, 'release.keystore');
    if (!fs.existsSync(keystore)) {
        run(`"${KEYTOOL}" -genkeypair -validity 10000 -dname "CN=ThienPhat, OU=Software, O=ThienPhatTech, L=HCM, ST=VN, C=VN" -keystore "${keystore}" -storepass thienphat2026 -keypass thienphat2026 -alias licgen -keyalg RSA -keysize 2048`);
    }

    console.log('--- STEP 8: Signing APK with APKSIGNER ---');
    const signedLocalApk = path.join(PROJECT, 'PCCareLicGen.apk');
    if (fs.existsSync(signedLocalApk)) fs.unlinkSync(signedLocalApk);
    run(`cmd.exe /c ""${APKSIGNER}" sign --ks "${keystore}" --ks-pass pass:thienphat2026 --key-pass pass:thienphat2026 --ks-key-alias licgen --out "${signedLocalApk}" "${alignedApk}""`);

    console.log('--- STEP 9: Verifying APK signature ---');
    run(`cmd.exe /c ""${APKSIGNER}" verify "${signedLocalApk}""`);

    const targetApk = 'C:/Users/PC/Desktop/Bộ Tool/PCCareLicGen.apk';
    fs.copyFileSync(signedLocalApk, targetApk);

    const stat = fs.statSync(targetApk);
    console.log('====================================================');
    console.log('SUCCESS! Built standalone APK:');
    console.log('File:', targetApk);
    console.log('Size:', (stat.size / 1024).toFixed(1), 'KB');
    console.log('====================================================');

} catch (e) {
    console.error('BUILD FAILED:', e.message);
    process.exit(1);
}
