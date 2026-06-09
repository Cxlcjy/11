export type PeriodRecord = {
  id: string;
  startDate: string;
  endDate: string;
  note: string;
};

export type TrackerSettings = {
  cycleLength: number;
  darkMode: boolean;
};

export type TrackerState = {
  records: PeriodRecord[];
  dayNotes: Record<string, string>;
  settings: TrackerSettings;
};

export type Prediction = {
  nextPeriodStart: string;
  ovulationDate: string;
  fertileStart: string;
  fertileEnd: string;
  fertileDates: Set<string>;
};

export type PredictionSeries = {
  nextPeriodStarts: Set<string>;
  predictedPeriodDates: Set<string>;
  ovulationDates: Set<string>;
  fertileDates: Set<string>;
};
