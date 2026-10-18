// Entry: the village slice ("Arrival", Lorenzo) is the default start; ?level=nightshift keeps the Night Shift chapter.
const level = new URLSearchParams(location.search).get('level');
if (level === 'nightshift') void import('./nightshiftMain');
else void import('./villageMain');
