export type StationConnection = {
  connector_type: string;
  power_kw: number;
  current_type: string | null;
  quantity: number;
  /** OpenChargeMap ConnectionTypeID; null on the first cache, before ids were stored. */
  connection_type_id?: number | null;
};

export type Station = {
  ocm_id: number;
  name: string;
  town: string | null;
  latitude: number;
  longitude: number;
  num_points: number | null;
  data_quality: number | null;
  connections: StationConnection[];
};
