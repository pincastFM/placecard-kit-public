// An OpenTripPlanner 2.x answer to the kit's plan query (buildOtpPlanQuery), written by hand from the
// GTFS GraphQL API's schema (plan > itineraries > legs): Union Square to Williamsburg on a Saturday
// morning, by the L, and the same way on foot. Times are ms since 1970 (OTP's Long); 1795878000000 is
// 2026-11-28 10:00 in New York. Each polyline is a Google encoded polyline of the points beside it.
export const T0 = 1795878000000
const min = (n: number) => T0 + n * 60000

export const OTP_PLAN = {
  data: {
    plan: {
      itineraries: [
        {
          startTime: min(0),
          endTime: min(20),
          duration: 1200,
          walkDistance: 620,
          waitingTime: 180,
          legs: [
            {
              mode: 'WALK', startTime: min(0), endTime: min(2), duration: 120, distance: 120, headsign: null,
              from: { name: 'Origin', lat: 40.7359, lon: -73.9911, stop: null },
              to: { name: '14 St-Union Sq', lat: 40.73479, lon: -73.99073, stop: { gtfsId: 'MTASBWY:L03', name: '14 St-Union Sq', platformCode: null } },
              legGeometry: { points: 'kfswFjkrbMvBwBdBl@' }, // (40.7359,-73.9911) (40.7353,-73.9905) (40.73479,-73.99073)
              route: null,
              intermediateStops: null,
              steps: [
                { distance: 80, relativeDirection: 'DEPART', absoluteDirection: 'SOUTHEAST', streetName: 'Union Square East', lat: 40.7359, lon: -73.9911 },
                { distance: 40, relativeDirection: 'RIGHT', absoluteDirection: 'SOUTHWEST', streetName: 'East 14th Street', lat: 40.7353, lon: -73.9905 },
              ],
            },
            {
              mode: 'SUBWAY', startTime: min(5), endTime: min(14), duration: 540, distance: 3600, headsign: 'Canarsie - Rockaway Pkwy',
              from: { name: '14 St-Union Sq', lat: 40.73479, lon: -73.99073, stop: { gtfsId: 'MTASBWY:L03', name: '14 St-Union Sq', platformCode: 'L' } },
              to: { name: 'Bedford Av', lat: 40.7173, lon: -73.95687, stop: { gtfsId: 'MTASBWY:L08', name: 'Bedford Av', platformCode: null } },
              legGeometry: { points: 'm_swF`irbM~Ny[xFa[ntAwyC' }, // Union Sq, 3 Av, 1 Av, Bedford Av
              route: { shortName: 'L', longName: '14 St-Canarsie Local', color: 'A7A9AC', textColor: 'FFFFFF', agency: { name: 'MTA New York City Transit' } },
              intermediateStops: [{ name: '3 Av' }, { name: '1 Av' }],
              steps: [],
            },
            {
              mode: 'WALK', startTime: min(14), endTime: min(20), duration: 360, distance: 500, headsign: null,
              from: { name: 'Bedford Av', lat: 40.7173, lon: -73.95687, stop: { gtfsId: 'MTASBWY:L08', name: 'Bedford Av', platformCode: null } },
              to: { name: 'Destination', lat: 40.7142, lon: -73.9614, stop: null },
              legGeometry: { points: 'crowFlukbMjHhL~H~M' }, // Bedford Av (40.7173,-73.95687) (40.7158,-73.959) (40.7142,-73.9614)
              route: null,
              intermediateStops: null,
              steps: [{ distance: 500, relativeDirection: 'DEPART', absoluteDirection: 'SOUTHWEST', streetName: 'Bedford Avenue', lat: 40.7173, lon: -73.95687 }],
            },
          ],
        },
        {
          startTime: min(0),
          endTime: min(45),
          duration: 2700,
          walkDistance: 3500,
          waitingTime: 0,
          legs: [
            {
              mode: 'WALK', startTime: min(0), endTime: min(45), duration: 2700, distance: 3500,
              from: { name: 'Origin', lat: 40.7359, lon: -73.9911, stop: null },
              to: { name: 'Destination', lat: 40.7142, lon: -73.9614, stop: null },
              legGeometry: { points: 'kfswFjkrbMbcAk}AnbAgzA' }, // (40.7359,-73.9911) (40.725,-73.976) (40.7142,-73.9614)
              route: null,
              steps: [],
            },
          ],
        },
        // not an itinerary the kit can time: no end time
        { startTime: min(0), legs: [] },
      ],
    },
  },
}
