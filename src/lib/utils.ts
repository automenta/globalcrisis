import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Simplex Noise implementation
// Based on Stefan Gustavson's Java implementation: http://staffwww.itn.liu.se/~stegu/simplexnoise/SimplexNoise.java
// and ported to JavaScript by various authors. This version is a common adaptation.

class Grad {
  constructor(public x: number, public y: number, public z: number) {}
}

const grad3 = [
  new Grad(1,1,0),new Grad(-1,1,0),new Grad(1,-1,0),new Grad(-1,-1,0),
  new Grad(1,0,1),new Grad(-1,0,1),new Grad(1,0,-1),new Grad(-1,0,-1),
  new Grad(0,1,1),new Grad(0,-1,1),new Grad(0,1,-1),new Grad(0,-1,-1)
];

const p = new Uint8Array(256);
for(let i=0; i < 256; i++) p[i] = i;

let perm = new Uint8Array(512);
let permMod12 = new Uint8Array(512);

const shuffle = (array: Uint8Array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
};

shuffle(p);

for(let i=0; i < 512; i++) {
  perm[i] = p[i & 255];
  permMod12[i] = perm[i] % 12;
}

// Skewing and unskewing factors for 2D
const F2 = 0.5*(Math.sqrt(3.0)-1.0);
const G2 = (3.0-Math.sqrt(3.0))/6.0;

// Helper function for dot product
const dot2 = (g: Grad, x: number, y: number) => g.x*x + g.y*y;


export class SimplexNoise {
  private static initialized = false;

  constructor(seed?: number | string) {
    if (SimplexNoise.initialized && seed === undefined) return; // Allow re-instantiation without re-seeding if no seed is given

    if (seed !== undefined) {
      const random = SimplexNoise.createPRNG(String(seed));
      const pSeed = new Uint8Array(256);
      for (let i = 0; i < 256; i++) pSeed[i] = i;

      for (let i = pSeed.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [pSeed[i], pSeed[j]] = [pSeed[j], pSeed[i]];
      }

      for(let i=0; i < 512; i++) {
        perm[i] = pSeed[i & 255];
        permMod12[i] = perm[i] % 12;
      }
    } else if (!SimplexNoise.initialized) {
      // Default shuffle if no seed and not initialized
      const pDefault = new Uint8Array(256);
      for(let i=0; i < 256; i++) pDefault[i] = i;
      shuffle(pDefault); // Use the existing shuffle with Math.random()
      for(let i=0; i < 512; i++) {
        perm[i] = pDefault[i & 255];
        permMod12[i] = perm[i] % 12;
      }
    }
    SimplexNoise.initialized = true;
  }

  private static createPRNG(seedStr: string): () => number {
    let seed = 0;
    for (let i = 0; i < seedStr.length; i++) {
        seed = ((seed << 5) - seed) + seedStr.charCodeAt(i);
        seed |= 0; // Convert to 32bit integer
    }

    return function() {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    };
  }


  public noise2D(xin: number, yin: number): number {
    let n0, n1, n2; // Noise contributions from the three corners
    // Skew the input space to determine which simplex cell we're in
    const s = (xin+yin)*F2; // Hairy factor for 2D
    const i = Math.floor(xin+s);
    const j = Math.floor(yin+s);
    const t = (i+j)*G2;
    const X0 = i-t; // Unskew the cell origin back to (x,y) space
    const Y0 = j-t;
    const x0 = xin-X0; // The x,y distances from the cell origin
    const y0 = yin-Y0;
    // For the 2D case, the simplex shape is an equilateral triangle.
    // Determine which simplex we are in.
    let i1, j1; // Offsets for second corner of simplex in (i,j) coords
    if(x0>y0) {i1=1; j1=0;} // Lower triangle, XY order: (0,0)->(1,0)->(1,1)
    else {i1=0; j1=1;}      // Upper triangle, YX order: (0,0)->(0,1)->(1,1)
    // A step of (1,0) in (i,j) means a step of (1-c,-c) in (x,y), and
    // a step of (0,1) in (i,j) means a step of (-c,1-c) in (x,y), where
    // c = (3-sqrt(3))/6
    const x1 = x0 - i1 + G2; // Offsets for second corner in (x,y) coords
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2; // Offsets for third corner in (x,y) coords
    const y2 = y0 - 1.0 + 2.0 * G2;
    // Work out the hashed gradient indices of the three simplex corners
    const ii = i & 255;
    const jj = j & 255;
    const gi0 = permMod12[ii+perm[jj]];
    const gi1 = permMod12[ii+i1+perm[jj+j1]];
    const gi2 = permMod12[ii+1+perm[jj+1]];
    // Calculate the contribution from the three corners
    let t0 = 0.5 - x0*x0-y0*y0;
    if(t0<0) n0 = 0.0;
    else {
      t0 *= t0;
      n0 = t0 * t0 * dot2(grad3[gi0], x0, y0);  // (x,y) of grad3 used for 2D gradient
    }
    let t1 = 0.5 - x1*x1-y1*y1;
    if(t1<0) n1 = 0.0;
    else {
      t1 *= t1;
      n1 = t1 * t1 * dot2(grad3[gi1], x1, y1);
    }
    let t2 = 0.5 - x2*x2-y2*y2;
    if(t2<0) n2 = 0.0;
    else {
      t2 *= t2;
      n2 = t2 * t2 * dot2(grad3[gi2], x2, y2);
    }
    // Add contributions from each corner to get the final noise value.
    // The result is scaled to return values in the interval [-1,1].
    return 70.0 * (n0 + n1 + n2);
  }
}

// Fractional Brownian Motion (FBM) function using SimplexNoise
export function fbm(
  noiseGen: SimplexNoise,
  x: number,
  y: number,
  octaves: number,
  persistence: number,
  lacunarity: number,
  initialScale: number // Added initialScale to match Earth3D's FBM-like structure
): number {
  let total = 0;
  let frequency = 1;
  let amplitude = 1;
  let maxValue = 0; // Used for normalizing result to 0-1

  for (let i = 0; i < octaves; i++) {
    total += noiseGen.noise2D(x * frequency / initialScale, y * frequency / initialScale) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return (total / maxValue + 1) / 2; // Normalize to 0-1 range
}
