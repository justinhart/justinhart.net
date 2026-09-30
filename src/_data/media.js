const fs = require('fs');
const path = require('path');

function newestFirst(a, b) {
  return (b.date || '').localeCompare(a.date || '') || a.title.localeCompare(b.title);
}
function displayDate(value) {
  if (!value) return 'Date not listed';
  const [year, month, day] = value.split('-').map(Number);
  if (!month) return String(year);
  const name = new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-US', {month:'long', timeZone:'UTC'});
  return day ? `${name} ${day}, ${year}` : `${name} ${year}`;
}
module.exports = () => {
const videos = JSON.parse(fs.readFileSync(path.join(__dirname, 'videos.json'), 'utf8'));
const mentions = JSON.parse(fs.readFileSync(path.join(__dirname, 'mentions.json'), 'utf8'));
const all = videos.map(v => ({...v, displayDate:displayDate(v.date)})).sort(newestFirst);
const dated = mentions.filter(m => m.date).map(m => ({...m, displayDate:displayDate(m.date)})).sort(newestFirst);
const years = [...new Set(dated.map(m => m.date.slice(0, 4)))].sort().reverse();

return {
  all,
  sections:[
    {id:'talks',title:'Talks and presentations',description:'Invited talks, panels, and paper presentations. Event dates are used when known.'},
    {id:'lab',title:'Living with Robots Laboratory',description:'All four public uploads from the LivingWithRobotsLab YouTube channel, checked September 30, 2026. Sorted by upload date.',channelUrl:'https://www.youtube.com/@LivingWithRobotsLab'},
    {id:'research',title:'Research videos and profiles',description:'Research demonstrations and interviews, sorted by upload date.'},
    {id:'team',title:'RoboCup@Home',description:'Qualification and competition videos from UT Austin Villa @ Home and LisTex United, sorted by upload date. Competition years appear in the titles.',channelUrl:'https://www.cs.utexas.edu/~AustinVilla/athome/'}
  ].map(section=>({...section,items:all.filter(v=>v.section===section.id)})),
  mentionYears:years.map(year=>({year,items:dated.filter(m=>m.date.startsWith(year))})),
  undatedMentions:mentions.filter(m=>!m.date),
  mentionCount:mentions.filter(m=>m.linkStatus!==404).length,
};
};
