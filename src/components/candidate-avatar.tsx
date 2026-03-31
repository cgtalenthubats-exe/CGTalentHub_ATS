"use client";

import { cn } from "@/lib/utils";

interface CandidateAvatarProps {
    src?: string | null;
    name?: string;
    className?: string;
    style?: React.CSSProperties;
    hasHistory?: boolean;
    fallbackClassName?: string;
}

export function CandidateAvatar({ src, name, className, style, hasHistory, fallbackClassName }: CandidateAvatarProps) {
    const defaultAvatar = "https://ddeqeaicjyrevqdognbn.supabase.co/storage/v1/object/public/system/Blank%20Profile.JPG";
    const imgSrc = src || defaultAvatar;

    return (
        <div 
            className={cn(
                "relative rounded-full flex items-center justify-center shrink-0 bg-slate-100",
                hasHistory && "ring-2 ring-yellow-400 ring-offset-2 scale-110 shadow-lg z-20",
                className
            )} 
            style={{ 
                ...style,
                position: 'relative', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
        >
            <div 
                className="absolute inset-0 z-10 w-full h-full rounded-full"
                style={{ 
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', borderRadius: '9999px', zIndex: 10,
                    backgroundImage: `url("${imgSrc}")`, 
                    backgroundSize: 'cover', 
                    backgroundPosition: 'center',
                    backgroundColor: 'white'
                }} 
            />
        </div>
    );
}
