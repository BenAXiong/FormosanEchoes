'use client';

export default function EmptyStatePortal() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-8 text-center bg-[#07070a]">
      <div className="w-72 h-72 rounded-full overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] pointer-events-none select-none">
        <video 
          src="/FE_1_lite.mp4" 
          autoPlay 
          muted 
          loop 
          playsInline 
          className="w-full h-full object-cover"
        />
      </div>
      <p className="text-stone-500 text-sm font-medium tracking-wide">Select a song to start listening</p>
    </div>
  );
}
