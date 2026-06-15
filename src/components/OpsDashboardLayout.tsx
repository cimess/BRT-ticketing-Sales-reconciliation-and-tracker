// import React from 'react';
// import { OpsSidebar } from './OpsSidebar';
// import { OpsTopBar } from './OpsTopBar';
// import type {DashboardRole} from '../app/libs/modules';

// export function OpsDashboardLayout({
//   role: roleProp,
//   title = 'Dashboard',
//   userLabel = 'User',
//   alertCount = 0,
// }: {
//   role?: DashboardRole;
//   title?: string;
//   userLabel?: string;
//   alertCount?: number;
// }) {



//   const [mobileOpen, setMobileOpen] = React.useState(false);
//   const [collapsed, setCollapsed] = React.useState(false);

//   return (
//     <div className="flex h-screen overflow-hidden bg-linear-to-b from-black via-slate-950 to-black text-white">
//       {/* mobile overlay */}
//       <div
//         className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden ${mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
//         onClick={() => setMobileOpen(false)}
//       />

//       <div className={`fixed lg:static inset-y-0 left-0 z-50 transform lg:translate-x-0 transition-transform ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} `}>
//         <OpsSidebar
//           role={roleProp || 'ticketer'}
//           userLabel={userLabel}
//           collapsed={collapsed}
//           onToggleCollapse={() => setCollapsed((v) => !v)}
//           onCloseMobile={() => setMobileOpen(false)}
//         />
//       </div>

//       <div className="flex-1 flex flex-col overflow-hidden">
//         <OpsTopBar
//           title={title}
//           alertCount={alertCount}
//           right={
//             <button
//               className="lg:hidden rounded-xl bg-white/3 border border-white/10 px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-slate-300 hover:bg-white/6 hover:text-white"
//               onClick={() => setMobileOpen(true)}
//             >
//               Menu
//             </button>
//           }
//         />

//         <main className="flex-1 overflow-y-auto p-4 lg:p-6">
  
//         </main>
//       </div>
//     </div>
//   );
// }