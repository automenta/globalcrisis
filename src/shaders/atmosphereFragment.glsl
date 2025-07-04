uniform vec3 uSunPosition; // Position of the sun in world space
uniform float uAtmosphereRadius; // Radius of the atmosphere sphere
uniform float uEarthRadius; // Radius of the Earth sphere
uniform vec3 uCameraPosition; // Camera position in world space

varying vec3 vNormal;
varying vec3 vPosition;

const vec3 kRayleighCoefficients = vec3(0.105, 0.224, 0.469); // Approximate RGB scattering coefficients (stronger blue)
const float kScatteringStrength = 4.5; // Controls overall intensity of scattering
const float kRayleighScaleHeight = 0.1; // Affects density falloff with altitude

float rayleighPhase(float cosTheta) {
  // Rayleigh phase function: 3/4 * (1 + cos^2(theta))
  // Simplified here, as we often just use the scattering coefficients directly for limb effects.
  // For more accuracy, this would be used with optical depth calculations.
  return 0.75 * (1.0 + cosTheta * cosTheta);
}

void main() {
  vec3 rayDir = normalize(vPosition - uCameraPosition);
  vec3 atmosphereNormal = normalize(vPosition - vec3(0.0)); // Assuming Earth/atmosphere is at origin

  // Calculate the distance from camera to the point on the atmosphere sphere
  // This is a simplification. A full solution involves ray-sphere intersection.

  // Angle between view direction and normal (for limb effect)
  float viewNormalDot = dot(-rayDir, atmosphereNormal);

  // Angle between sun direction and normal (for sunlit side)
  vec3 sunDir = normalize(uSunPosition - vPosition); // Simplified: sun is distant
  float sunNormalDot = max(0.0, dot(sunDir, atmosphereNormal));

  // Simulate density: higher at the "surface" of the atmosphere, thinner outwards
  // This is a very simplified density approximation for limb effect
  float densityFactor = smoothstep(0.0, 0.6, viewNormalDot); // Stronger effect at grazing angles
  densityFactor = pow(densityFactor, 2.0);

  // Basic limb darkening/brightening effect based on view angle to normal
  // Color should be more intense at the horizon (limb)
  vec3 scatteredLight = kRayleighCoefficients * kScatteringStrength * densityFactor;

  // Modulate by sunlight (basic diffuse lighting on atmosphere itself)
  scatteredLight *= sunNormalDot * 0.5 + 0.5; // So it's not completely black on night side

  // Make sure the atmosphere is transparent where it should be
  // This is a very basic alpha, a proper solution would use optical depth.
  float alpha = densityFactor * 0.6 + 0.1; // More opaque at limb, somewhat transparent overall

  // If looking from outside, fade out if normal is facing away from camera
  if (dot(vNormal, -rayDir) < 0.1) { // If we are looking at the "back" of the atmosphere sphere from outside
     alpha = 0.0; // Make it disappear
  }


  gl_FragColor = vec4(scatteredLight, alpha);
}
