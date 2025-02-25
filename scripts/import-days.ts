import { createReadStream } from 'fs';
import { parse } from 'csv-parse';
import axios from 'axios';

const API_URL = 'http://localhost:3000/days';

interface DayData {
  user_id: number;
  morning_score: string;
  afternoon_score: string;
  evening_score: string | null;
  extra_score: string | null;
  date: string;
  sport: boolean;
}

const scoreMapping: { [key: string]: 'empty' | 'light' | 'normal' | 'heavy' } =
  {
    '0': 'empty',
    '1': 'light',
    '2': 'normal',
    '3': 'heavy',
  };

async function importDays() {
  const parser = createReadStream('Days_data.csv').pipe(
    parse({ columns: true, delimiter: ',' }),
  );

  for await (const record of parser) {
    const dayData: DayData = {
      user_id: parseInt(record.user_id),
      morning_score: scoreMapping[record.morning_score],
      afternoon_score: scoreMapping[record.afternoon_score],
      evening_score: record.evening_score
        ? scoreMapping[record.evening_score]
        : null,
      extra_score: record.extra_score ? scoreMapping[record.extra_score] : null,
      date: new Date(record.date).toISOString(),
      sport: record.sport === 'true',
    };

    try {
      const response = await axios.post(API_URL, dayData);
      console.log(`Imported day ID: ${response.data.id}`);
    } catch (error) {
      console.error(
        `Error importing day:`,
        error.response?.data || error.message,
      );
    }
  }
}

// Exécuter le script
importDays()
  .then(() => {
    console.log('Import completed');
  })
  .catch((error) => {
    console.error('Import failed:', error);
  });
