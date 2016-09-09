export function GetTerrainVertexShader(): string { return `
uniform vec2 uGlobalOffset;
uniform sampler2D uHeightData;
uniform vec2 uTileOffset;
uniform float uScale;
uniform float uTileResolution;

varying vec3 vNormal;
varying vec3 vPosition;
varying float vMorphFactor;

// Number of vertices along edge of tile

float getHeight(vec3 p) {
	// Assume a 1024x1024 world
	float lod = 0.0;//log2(uScale) - 6.0;
	vec2 st = p.xz / 1024.0;

	// Sample multiple times to get more detail out of map
	float h = 1024.0 * texture2DLod(uHeightData, st, lod).a;
	h += 64.0 * texture2DLod(uHeightData, 16.0 * st, lod).a;
	h += 4.0 * texture2DLod(uHeightData, 256.0 * st, lod).a;
	h += 2.0 * texture2DLod(uHeightData, 256.0 * 4.0 * st, lod).a;

	// Square the height, leads to more rocky looking terrain
	return h * h / 2000.0;
	//return h / 10.0;
}

vec3 getNormal() {
	// Get 2 vectors perpendicular to the unperturbed normal, and create at point at each (relative to position)
	//float delta = 1024.0 / 4.0;
	float delta = (vMorphFactor + 1.0) * uScale / uTileResolution;
	vec3 dA = delta * normalize(cross(normal.xyz, normal));
	vec3 dB = delta * normalize(cross(dA, normal));
	vec3 p = vPosition;
	vec3 pA = vPosition + dA;
	vec3 pB = vPosition + dB;

	// Now get the height at those points
	float h = getHeight(vPosition);
	float hA = getHeight(pA);
	float hB = getHeight(pB);

	// Update the points with their correct heights and calculate true normal
	p += normal * h;
	pA += normal * hA;
	pB += normal * hB;
	return normalize(cross(pB - p, pA - p));
}

#include <edgemorph>

void main() {
	// Morph factor tells us how close we are to next level.
	// 0.0 is this level
	// 1.0 is next level
	vMorphFactor = calculateMorph(position);

	// Move into correct place
	vPosition = uScale * vec3(position.x, 0, position.z) + vec3(uTileOffset.x, 0, uTileOffset.y) + vec3(uGlobalOffset.x, 0, uGlobalOffset.y);

	// Snap to grid
	float grid = uScale / uTileResolution;
	vPosition = floor(vPosition / grid) * grid;

	// Morph between zoom layers
	if( vMorphFactor > 0.0 ) {
		// Get position that we would have if we were on higher level grid
		grid = 2.0 * grid;
		vec3 position2 = floor(vPosition / grid) * grid;

		// Linearly interpolate the two, depending on morph factor
		vPosition = mix(vPosition, position2, vMorphFactor);
	}

	// Get height and calculate normal
	vPosition = vPosition + normal * getHeight(vPosition);
	vNormal = getNormal();
	vNormal = normal;
	gl_Position = projectionMatrix * modelViewMatrix * vec4(vPosition, 1.0);
}
`;}