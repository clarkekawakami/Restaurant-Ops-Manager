import React from 'react';
import {
  UtensilsCrossed,
  ChefHat,
  Flame,
  Wine,
  Coffee,
  Pizza,
  Beer,
  Store,
} from 'lucide-react';

export interface RestaurantLogoProps {
  logoUrl?: string;
  logoIcon?: string;
  altText?: string;
  className?: string;
  iconClassName?: string;
}

export function RestaurantLogo({
  logoUrl,
  logoIcon = 'utensils',
  altText = 'Restaurant Logo',
  className = 'w-10 h-10 rounded-xl bg-slate-900 dark:bg-slate-800 flex items-center justify-center shadow-xs border border-transparent dark:border-slate-700 overflow-hidden',
  iconClassName = 'w-5 h-5 text-amber-400',
}: RestaurantLogoProps) {
  if (logoUrl && logoUrl.trim().length > 0) {
    return (
      <div className={className}>
        <img
          src={logoUrl}
          alt={altText}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback to icon if image fails to load
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      </div>
    );
  }

  const renderIcon = () => {
    switch (logoIcon) {
      case 'chef-hat':
        return <ChefHat className={iconClassName} />;
      case 'flame':
        return <Flame className={iconClassName} />;
      case 'wine':
        return <Wine className={iconClassName} />;
      case 'coffee':
        return <Coffee className={iconClassName} />;
      case 'pizza':
        return <Pizza className={iconClassName} />;
      case 'beer':
        return <Beer className={iconClassName} />;
      case 'store':
        return <Store className={iconClassName} />;
      case 'utensils':
      default:
        return <UtensilsCrossed className={iconClassName} />;
    }
  };

  return <div className={className}>{renderIcon()}</div>;
}
