const fs = require('fs');

// Load the JSON file
const data = JSON.parse(fs.readFileSync('load-reports.json', 'utf8'));

// Structure to hold stats by botId
const bots = {}; // { botId: { totalMessages: {}, messagesPerHour: {} } }

data.forEach(entry => {
  const { botId, groups, duration } = entry;
  if (!groups || !botId || !duration) return;

  const hours = duration / 3600; // assuming duration is in seconds

  if (!bots[botId]) {
    bots[botId] = {
      totalMessages: {},      // { groupId: total }
      messagesPerHour: {}     // { groupId: sum of per-hour estimates }
    };
  }

  for (const [groupId, count] of Object.entries(groups)) {
    // Aggregate total messages
    bots[botId].totalMessages[groupId] = (bots[botId].totalMessages[groupId] || 0) + count;

    // Aggregate messages per hour
    const perHour = count / hours;
    bots[botId].messagesPerHour[groupId] = (bots[botId].messagesPerHour[groupId] || 0) + perHour;
  }
});

// Output report per botId
for (const [botId, stats] of Object.entries(bots)) {
  console.log(`\n=== Bot: ${botId} ===`);

  // Top 10 total messages
  const totalTop10 = Object.entries(stats.totalMessages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  console.log('\nTop 10 groups by total messages:');
  totalTop10.forEach(([groupId, total], i) => {
    console.log(`${i + 1}. ${groupId}: ${total} messages`);
  });

  // Top 10 messages per hour
  const perHourTop10 = Object.entries(stats.messagesPerHour)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  console.log('\nTop 10 groups by messages per hour:');
  perHourTop10.forEach(([groupId, perHour], i) => {
    console.log(`${i + 1}. ${groupId}: ${perHour.toFixed(2)} messages/hour`);
  });

  // Optionally show all per-hour values
  /*
  console.log('\nAll groups (messages/hour):');
  for (const [groupId, perHour] of Object.entries(stats.messagesPerHour)) {
    console.log(`${groupId}: ${perHour.toFixed(2)} messages/hour`);
  }
  */
}
