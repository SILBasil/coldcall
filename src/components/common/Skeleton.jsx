import React from 'react';

export const Skeleton = ({ className, variant = 'rect' }) => {
  const baseClass = "animate-pulse bg-slate-200/60 rounded-lg";
  const variantClasses = {
    rect: "h-4 w-full",
    circle: "rounded-full",
    card: "h-32 w-full",
    text: "h-3 w-3/4",
    title: "h-6 w-1/2",
    badge: "h-5 w-20 rounded-full"
  };

  return <div className={`${baseClass} ${variantClasses[variant]} ${className}`} />;
};

export const DashboardSkeleton = () => (
  <div className="space-y-6 animate-in fade-in duration-500 max-w-[1400px] mx-auto pb-8">
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-slate-100">
      <Skeleton variant="title" className="w-64" />
      <Skeleton variant="rect" className="w-80 h-12 rounded-2xl" />
    </div>
    
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map(i => (
        <Skeleton key={i} variant="card" className="rounded-3xl h-36" />
      ))}
    </div>

    <Skeleton variant="rect" className="h-24 rounded-3xl" />

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Skeleton variant="rect" className="h-[500px] rounded-[2.5rem]" />
      <Skeleton variant="rect" className="h-[500px] rounded-[2.5rem]" />
    </div>
  </div>
);

export const TableSkeleton = () => (
  <div className="space-y-4">
    <div className="flex justify-between items-center gap-4">
      <Skeleton variant="rect" className="w-64 h-10 rounded-xl" />
      <Skeleton variant="rect" className="w-48 h-10 rounded-xl" />
    </div>
    <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm">
      <div className="p-6 space-y-4">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-4 py-3 border-b border-slate-50 last:border-0">
            <Skeleton variant="circle" className="w-10 h-10" />
            <div className="flex-1 space-y-2">
              <Skeleton variant="title" className="w-1/3" />
              <Skeleton variant="text" className="w-1/4" />
            </div>
            <Skeleton variant="badge" />
            <Skeleton variant="circle" className="w-10 h-10" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

export const ManagerSkeleton = () => (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-[1600px] mx-auto pb-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-slate-100">
        <Skeleton variant="title" className="w-72" />
        <Skeleton variant="rect" className="w-96 h-12 rounded-2xl" />
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} variant="card" className="rounded-3xl h-40" />
        ))}
      </div>
  
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Skeleton variant="rect" className="h-64 rounded-[2.5rem]" />
              <Skeleton variant="rect" className="h-64 rounded-[2.5rem]" />
           </div>
           <Skeleton variant="rect" className="h-[400px] rounded-[2.5rem]" />
        </div>
        <div className="lg:col-span-4 space-y-6">
           <Skeleton variant="rect" className="h-[350px] rounded-[3rem]" />
           <Skeleton variant="rect" className="h-[450px] rounded-[3rem]" />
        </div>
      </div>
    </div>
  );
