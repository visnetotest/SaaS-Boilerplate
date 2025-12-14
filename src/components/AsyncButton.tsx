'use client';

import { useTransition, useState } from 'react';

interface AsyncButtonProps {
  children: React.ReactNode;
  onClick: () => Promise<void> | void;
  className?: string;
  disabled?: boolean;
}

export const AsyncButton = ({ 
  children, 
  onClick, 
  className = '', 
  disabled = false 
}: AsyncButtonProps) => {
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = () => {
    if (isLoading || isPending || disabled) return;
    
    startTransition(async () => {
      setIsLoading(true);
      try {
        await onClick();
      } finally {
        setIsLoading(false);
      }
    });
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || isLoading || isPending}
      className={`relative ${className}`}
    >
      {(isLoading || isPending) && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        </div>
      )}
      <span className={isLoading || isPending ? 'opacity-0' : ''}>
        {children}
      </span>
    </button>
  );
};