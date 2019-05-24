import {D2R, R2D, PJD_3PARAM, PJD_7PARAM} from './constants/values';
import datum_transform from './datum_transform';
import adjust_axis from './adjust_axis';
import proj from './Proj';
import toPoint from './common/toPoint';
import checkSanity from './checkSanity';

function checkNotWGS(source, dest) {
  return ((source.datum.datum_type === PJD_3PARAM || source.datum.datum_type === PJD_7PARAM) && dest.datumCode !== 'WGS84') || ((dest.datum.datum_type === PJD_3PARAM || dest.datum.datum_type === PJD_7PARAM) && source.datumCode !== 'WGS84');
}

export default function transform(source, dest, point) {
  var wgs84;
  if (Array.isArray(point)) {
    point = toPoint(point);
  }
  checkSanity(point);
  // Workaround for datum shifts towgs84, if either source or destination projection is not wgs84
  if (source.datum && dest.datum && checkNotWGS(source, dest)) {
    wgs84 = new proj('WGS84');
    point = transform(source, wgs84, point);
    source = wgs84;
  }
  // DGR, 2010/11/12
  if (source.axis !== 'enu') {
    point = adjust_axis(source, false, point);
  }
  // Transform source points to long/lat, if they aren't already.
  if (source.projName === 'longlat') {
    point = {
      x: point.x * D2R,
      y: point.y * D2R
    };
  }
  else {
    if (source.to_meter) {
      point = {
        x: point.x * source.to_meter,
        y: point.y * source.to_meter
      };
    }

    if (source.hasOwnProperty("s11") && source.hasOwnProperty("s12") && source.hasOwnProperty("s21") && source.hasOwnProperty("s22")) {
      var dt = (source.s11 * source.s22 - source.s12 * source.s21);
      var a = source.s22 /dt;
      var b = -source.s12 / dt;
      var c = -source.s21 / dt;
      var d = source.s11 / dt;
      point = {
        x: point.x * a + point.y * c,
        y: point.x * b + point.y * d
      };    
    }
    if (source.hasOwnProperty("xoff")){
      point = {
        x: point.x + source.xoff,
        y: point.y
      };
    }
    if (source.hasOwnProperty("yoff")){
      point = {
        x: point.x,
        y: point.y + source.yoff
      };
    }
    point = source.inverse(point); // Convert Cartesian to longlat
  }
  // Adjust for the prime meridian if necessary
  if (source.from_greenwich) {
    point.x += source.from_greenwich;
  }

  // Convert datums if needed, and if possible.
  point = datum_transform(source.datum, dest.datum, point);

  // Adjust for the prime meridian if necessary
  if (dest.from_greenwich) {
    point = {
      x: point.x - dest.from_greenwich,
      y: point.y
    };
  }

  if (dest.projName === 'longlat') {
    // convert radians to decimal degrees
    point = {
      x: point.x * R2D,
      y: point.y * R2D
    };
  } else { // else project
    point = dest.forward(point);

    if (dest.hasOwnProperty("xoff")){
      point = {
        x: point.x - dest.xoff,
        y: point.y
      };
    }
    if (dest.hasOwnProperty("yoff")){
      point = {
        x: point.x,
        y: point.y - dest.yoff
      };
    }
    if (dest.hasOwnProperty("s11") && dest.hasOwnProperty("s12") && dest.hasOwnProperty("s21") && dest.hasOwnProperty("s22")) {     
      point = {
        x: point.x * dest.s11 + point.y * dest.s21,
        y: point.x * dest.s12 + point.y * dest.s22
      };    
    }

    if (dest.to_meter) {
      point = {
        x: point.x / dest.to_meter,
        y: point.y / dest.to_meter
      };
    }
  }

  // DGR, 2010/11/12
  if (dest.axis !== 'enu') {
    return adjust_axis(dest, true, point);
  }

  return point;
}
