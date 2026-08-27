import React from 'react';

type BaseProps = {
  children: React.ReactNode;
  className?: string;
};

export function UiSectionHeading({ children, className = '' }: BaseProps) {
  return <h2 className={className}>{children}</h2>;
}

export function UiInlineLabel({ children, className = '' }: BaseProps) {
  return <div className={className}>{children}</div>;
}
