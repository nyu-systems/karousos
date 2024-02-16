export enum Aggregation {
  sum = 'sum',
  average = 'average',
  minimum = 'minimum',
  maximum = 'maximum',
  firstMatching = 'firstMatching',
}

export enum ScoringFunctionType {
  magnitude = 'magnitude',
  freshness = 'freshness',
  distance = 'distance',
  tag = 'tag',
}

export enum Interpolation {
  constant = 'constant',
  linear = 'linear',
  quadratic = 'quadratic',
  logarithmic = 'logarithmic',
}

export interface MagnitudeFunction {
  boostingRangeStart: number;
  boostingRangeEnd: number;
  constantBoostBeyondRange?: boolean;
}

export interface FreshnessFunction {
  boostingDuration: string;
}

export interface DistanceFunction {
  referencePointParameter: string;
  boostingDistance: number;
}

export interface TagFunction {
  tagsParameter: string;
}

export interface ScoringFunction {
  type: ScoringFunctionType;
  boost: number;
  fieldName: string;
  interpolation?: Interpolation;
  magnitude?: MagnitudeFunction;
  freshness?: FreshnessFunction;
  distance?: DistanceFunction;
  tag?: TagFunction;
}

export interface ScoringWeights {
  weights: ScoringWeight;
}

export interface ScoringWeight {
  [ field: string ]: number;
}

export interface ScoringProfile {
  name: string;
  text?: ScoringWeights;
  functions?: ScoringFunction[];
  functionAggregation?: Aggregation;
}
