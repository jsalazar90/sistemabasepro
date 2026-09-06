import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface BackButtonProps {
  to?: string;
  onClick?: () => void;
  label?: string;
  className?: string;
}

export default function BackButton({
  to,
  onClick,
  label = 'Volver',
  className = ''
}: BackButtonProps) {
  const navigate = useNavigate();

  const baseStyles = "inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 rounded-xl transition-all duration-200 border border-slate-200/90 shadow-2xs text-xs font-bold group/back cursor-pointer active:scale-95 shrink-0 select-none";

  const content = (
    <>
      <ArrowLeft size={15} className="group-hover/back:-translate-x-0.5 transition-transform text-slate-500 group-hover/back:text-slate-900" />
      <span>{label}</span>
    </>
  );

  if (to) {
    return (
      <Link to={to} className={`${baseStyles} ${className}`}>
        {content}
      </Link>
    );
  }

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(-1);
    }
  };

  return (
    <button type="button" onClick={handleClick} className={`${baseStyles} ${className}`}>
      {content}
    </button>
  );
}
