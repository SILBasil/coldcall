import React from 'react';
import { DAYS } from '../../constants';

const TeamLineChart = ({ admins }) => {
  const width = 1000;
  const height = 300;
  const padding = 40;
  const getY = (val) => height - padding - (val * (height - 2 * padding) / 40);
  const getX = (i) => padding + (i * (width - 2 * padding) / (DAYS.length - 1));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full min-h-[240px]">
       {admins.map(admin => {
          const d = admin.weeklyHistory.reduce((acc, val, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(val)}`, "");
          return (
            <path key={admin.id} d={d} fill="none" stroke={admin.color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          );
       })}
    </svg>
  );
};

export default TeamLineChart;
