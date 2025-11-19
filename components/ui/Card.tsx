import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
}

const Card: React.FC<CardProps> = ({ children, className = '', as: Component = 'div' }) => {
  return (
    <Component className={`bg-white rounded-xl shadow-md overflow-hidden ${className}`}>
      {children}
    </Component>
  );
};

export default Card;
