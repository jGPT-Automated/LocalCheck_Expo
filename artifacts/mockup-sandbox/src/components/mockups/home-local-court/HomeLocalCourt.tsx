import React, { useState } from 'react';
import { Home, CalendarDays, Trophy, Map, User, Settings2, Check, ChevronRight } from "lucide-react";

export function HomeLocalCourt() {
  const [hasCourt, setHasCourt] = useState(true);

  if (!hasCourt) {
    return (
      <div className="flex flex-col h-[100dvh] w-full max-w-[390px] mx-auto bg-black text-white font-['Inter'] relative border-x border-white/10 overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center px-4 py-4 border-b border-white/15 sticky top-0 bg-black z-10">
          <span className="font-['Oswald'] font-bold text-lg tracking-wide uppercase">HOME</span>
          <Settings2 className="w-5 h-5 text-white/70" />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6">
          <div className="w-16 h-16 border-2 border-white/15 flex items-center justify-center mb-2">
            <Map className="w-8 h-8 text-white/50" />
          </div>
          <h1 className="font-['Oswald'] font-bold text-3xl">YOUR LOCAL COURT</h1>
          <p className="text-white/60">Find your home court and own it.</p>
          <button 
            onClick={() => setHasCourt(true)}
            className="w-full bg-[#DFFF00] text-black font-['Oswald'] font-bold text-lg py-4 uppercase tracking-wide mt-4"
          >
            FIND A COURT →
          </button>
        </div>

        {/* Bottom Nav */}
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-[390px] mx-auto bg-black text-white font-['Inter'] relative border-x border-white/10 overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-4 border-b border-white/15 sticky top-0 bg-black z-10">
        <span className="font-['Oswald'] font-bold text-lg tracking-wide uppercase">HOME</span>
        <button className="text-white/70 hover:text-white transition-colors">
          <Settings2 className="w-6 h-6" />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-24 no-scrollbar">
        {/* Hero Block */}
        <div className="bg-[#111111] p-5 pb-6 border-b border-white/15 relative overflow-hidden">
          {/* Subtle noise/texture could go here */}
          
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold tracking-widest text-white/80 uppercase flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-[#DFFF00] mr-1.5"></span>
                BASKETBALL
              </span>
              <span className="text-[10px] font-bold tracking-widest bg-white/10 px-2 py-0.5 uppercase flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-[#DFFF00] mr-1.5 animate-pulse"></span>
                12 ON COURT
              </span>
            </div>
            <span className="text-xs text-white/70 font-semibold">72° ☀</span>
          </div>

          <div className="flex justify-between items-start mb-1">
            <h1 className="font-['Oswald'] font-bold text-[32px] leading-none uppercase tracking-wide">
              RUCKER PARK
            </h1>
            <button className="text-[10px] font-bold text-white/50 uppercase tracking-wider flex items-center hover:text-[#DFFF00] transition-colors mt-2">
              VIEW <ChevronRight className="w-3 h-3 ml-0.5" />
            </button>
          </div>
          <p className="text-sm text-white/50 mb-4">Harlem · New York</p>

          <div className="flex overflow-x-auto no-scrollbar space-x-2 pb-2 -mx-5 px-5">
            {["COMMUNITY COURT", "ASPHALT", "LIGHTS", "DOUBLE RIM"].map((tag) => (
              <span key={tag} className="whitespace-nowrap text-[10px] font-semibold border border-white/15 px-2.5 py-1 text-white/80 uppercase tracking-wider">
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Check In Button */}
        <div className="px-4 py-3 bg-[#111111] border-b border-white/15">
          <button className="w-full bg-[#DFFF00] text-black font-['Oswald'] font-bold text-xl py-4 uppercase tracking-widest hover:bg-[#c9e600] transition-colors active:scale-[0.98]">
            CHECK IN
          </button>
        </div>

        {/* Who's Here */}
        <div className="p-5 border-b border-white/15">
          <div className="flex justify-between items-end mb-4">
            <h2 className="font-['Oswald'] font-bold text-lg tracking-wide uppercase">WHO'S HERE</h2>
            <span className="text-sm font-semibold text-[#DFFF00]">12 active</span>
          </div>
          
          <div className="flex items-center space-x-3">
            {["MJ", "DK", "ZM", "TB", "KP", "JR"].map((initials, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <div className="w-[42px] h-[42px] bg-[#1A1A1A] border border-white/15 flex items-center justify-center shrink-0">
                  <span className="font-['Oswald'] font-bold text-sm tracking-wide">{initials}</span>
                </div>
              </div>
            ))}
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-[42px] h-[42px] bg-[#111111] border border-white/15 flex items-center justify-center shrink-0">
                <span className="font-semibold text-xs text-white/60">+4</span>
              </div>
            </div>
          </div>
        </div>

        {/* Court Details */}
        <div className="p-5 border-b border-white/15 bg-[#111111]">
          <h2 className="font-['Oswald'] font-bold text-lg tracking-wide uppercase mb-4">COURT DETAILS</h2>
          <div className="grid grid-cols-2 gap-y-4 gap-x-6">
            <DetailItem value="2 COURTS" label="Courts" />
            <DetailItem value="1 HOOP" label="Hoops" />
            <DetailItem value="METAL NET" label="Net type" />
            <DetailItem value="DOUBLE RIM" label="Rim" />
            <DetailItem value="WATER" label="Fountain" />
            <DetailItem value="ADDED JAN 2024" label="Added" />
          </div>
        </div>

        {/* Recent Activity */}
        <div className="p-5">
          <div className="flex justify-between items-end mb-5">
            <h2 className="font-['Oswald'] font-bold text-lg tracking-wide uppercase">RECENT ACTIVITY</h2>
            <button className="text-[11px] font-bold text-[#DFFF00] uppercase tracking-wider flex items-center hover:underline">
              VIEW ALL <ChevronRight className="w-3 h-3 ml-0.5" />
            </button>
          </div>

          <div className="space-y-3">
            <ActivityItem 
              type="win"
              title={<><span className="font-bold text-white">MARCUS J.</span> won 21–14 vs DK, ZM, TB</>}
              time="2h ago"
              badge="+15 ELO"
              badgeColor="bg-[#DFFF00] text-black"
            />
            <ActivityItem 
              type="checkin"
              title={<><span className="font-bold text-white">KP</span> checked in</>}
              time="4h ago"
              icon={<Check className="w-3.5 h-3.5" />}
            />
            <ActivityItem 
              type="neutral"
              title="6-man run · 1h 20min"
              time="Yesterday"
            />
            <ActivityItem 
              type="loss"
              title={<><span className="font-bold text-white">MARCUS J.</span> lost 11–21</>}
              time="Mar 26"
              badge="-12"
              badgeColor="bg-red-500 text-white"
            />
          </div>
        </div>
      </div>

      {/* Bottom Nav */}
      <BottomNav />
      
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}

function DetailItem({ value, label }: { value: string, label: string }) {
  return (
    <div>
      <div className="font-['Oswald'] font-bold tracking-wide text-[15px]">{value}</div>
      <div className="text-[11px] text-white/50 uppercase font-semibold mt-0.5">{label}</div>
    </div>
  );
}

function ActivityItem({ 
  type, 
  title, 
  time, 
  badge, 
  badgeColor,
  icon
}: { 
  type: 'win' | 'loss' | 'checkin' | 'neutral',
  title: React.ReactNode,
  time: string,
  badge?: string,
  badgeColor?: string,
  icon?: React.ReactNode
}) {
  const barColors = {
    win: 'bg-[#DFFF00]',
    checkin: 'bg-[#DFFF00]',
    loss: 'bg-red-500',
    neutral: 'bg-white/20'
  };

  return (
    <div className="flex bg-[#111111] border border-white/10">
      <div className={`w-1 ${barColors[type]}`}></div>
      <div className="flex-1 p-3 flex justify-between items-center">
        <div>
          <div className="text-sm text-white/80">{title}</div>
          <div className="text-xs text-white/40 mt-1">{time}</div>
        </div>
        {(badge || icon) && (
          <div className={`text-xs font-['Oswald'] font-bold tracking-wide px-2 py-1 flex items-center justify-center ${badgeColor || 'text-white/60'}`}>
            {badge || icon}
          </div>
        )}
      </div>
    </div>
  );
}

function BottomNav() {
  return (
    <div className="flex justify-between items-center bg-[#0a0a0a] border-t border-white/15 px-6 py-3 pb-safe sticky bottom-0 z-20 h-[64px]">
      <NavItem icon={<Home className="w-6 h-6" />} label="Home" active />
      <NavItem icon={<CalendarDays className="w-6 h-6" />} label="Schedule" />
      <NavItem icon={<Trophy className="w-6 h-6" />} label="Compete" />
      <NavItem icon={<Map className="w-6 h-6" />} label="Explore" />
      <NavItem icon={<User className="w-6 h-6" />} label="Me" />
    </div>
  );
}

function NavItem({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-1 cursor-pointer ${active ? 'text-[#DFFF00]' : 'text-white/50'}`}>
      {icon}
      <span className="text-[10px] font-semibold">{label}</span>
    </div>
  );
}
