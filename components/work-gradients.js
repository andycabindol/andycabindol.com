(()=>{var B=`#version 300 es
precision mediump float;

layout(location = 0) in vec4 a_position;

uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform float u_imageAspectRatio;
uniform float u_originX;
uniform float u_originY;
uniform float u_worldWidth;
uniform float u_worldHeight;
uniform float u_fit;
uniform float u_scale;
uniform float u_rotation;
uniform float u_offsetX;
uniform float u_offsetY;

out vec2 v_objectUV;
out vec2 v_objectBoxSize;
out vec2 v_responsiveUV;
out vec2 v_responsiveBoxGivenSize;
out vec2 v_patternUV;
out vec2 v_patternBoxSize;
out vec2 v_imageUV;

vec3 getBoxSize(float boxRatio, vec2 givenBoxSize) {
  vec2 box = vec2(0.);
  // fit = none
  box.x = boxRatio * min(givenBoxSize.x / boxRatio, givenBoxSize.y);
  float noFitBoxWidth = box.x;
  if (u_fit == 1.) { // fit = contain
    box.x = boxRatio * min(u_resolution.x / boxRatio, u_resolution.y);
  } else if (u_fit == 2.) { // fit = cover
    box.x = boxRatio * max(u_resolution.x / boxRatio, u_resolution.y);
  }
  box.y = box.x / boxRatio;
  return vec3(box, noFitBoxWidth);
}

void main() {
  gl_Position = a_position;

  vec2 uv = gl_Position.xy * .5;
  vec2 boxOrigin = vec2(.5 - u_originX, u_originY - .5);
  vec2 givenBoxSize = vec2(u_worldWidth, u_worldHeight);
  givenBoxSize = max(givenBoxSize, vec2(1.)) * u_pixelRatio;
  float r = u_rotation * 3.14159265358979323846 / 180.;
  mat2 graphicRotation = mat2(cos(r), sin(r), -sin(r), cos(r));
  vec2 graphicOffset = vec2(-u_offsetX, u_offsetY);


  // ===================================================

  float fixedRatio = 1.;
  vec2 fixedRatioBoxGivenSize = vec2(
  (u_worldWidth == 0.) ? u_resolution.x : givenBoxSize.x,
  (u_worldHeight == 0.) ? u_resolution.y : givenBoxSize.y
  );

  v_objectBoxSize = getBoxSize(fixedRatio, fixedRatioBoxGivenSize).xy;
  vec2 objectWorldScale = u_resolution.xy / v_objectBoxSize;

  v_objectUV = uv;
  v_objectUV *= objectWorldScale;
  v_objectUV += boxOrigin * (objectWorldScale - 1.);
  v_objectUV += graphicOffset;
  v_objectUV /= u_scale;
  v_objectUV = graphicRotation * v_objectUV;

  // ===================================================

  v_responsiveBoxGivenSize = vec2(
  (u_worldWidth == 0.) ? u_resolution.x : givenBoxSize.x,
  (u_worldHeight == 0.) ? u_resolution.y : givenBoxSize.y
  );
  float responsiveRatio = v_responsiveBoxGivenSize.x / v_responsiveBoxGivenSize.y;
  vec2 responsiveBoxSize = getBoxSize(responsiveRatio, v_responsiveBoxGivenSize).xy;
  vec2 responsiveBoxScale = u_resolution.xy / responsiveBoxSize;

  #ifdef ADD_HELPERS
  v_responsiveHelperBox = uv;
  v_responsiveHelperBox *= responsiveBoxScale;
  v_responsiveHelperBox += boxOrigin * (responsiveBoxScale - 1.);
  #endif

  v_responsiveUV = uv;
  v_responsiveUV *= responsiveBoxScale;
  v_responsiveUV += boxOrigin * (responsiveBoxScale - 1.);
  v_responsiveUV += graphicOffset;
  v_responsiveUV /= u_scale;
  v_responsiveUV.x *= responsiveRatio;
  v_responsiveUV = graphicRotation * v_responsiveUV;
  v_responsiveUV.x /= responsiveRatio;

  // ===================================================

  float patternBoxRatio = givenBoxSize.x / givenBoxSize.y;
  vec2 patternBoxGivenSize = vec2(
  (u_worldWidth == 0.) ? u_resolution.x : givenBoxSize.x,
  (u_worldHeight == 0.) ? u_resolution.y : givenBoxSize.y
  );
  patternBoxRatio = patternBoxGivenSize.x / patternBoxGivenSize.y;

  vec3 boxSizeData = getBoxSize(patternBoxRatio, patternBoxGivenSize);
  v_patternBoxSize = boxSizeData.xy;
  float patternBoxNoFitBoxWidth = boxSizeData.z;
  vec2 patternBoxScale = u_resolution.xy / v_patternBoxSize;

  v_patternUV = uv;
  v_patternUV += graphicOffset / patternBoxScale;
  v_patternUV += boxOrigin;
  v_patternUV -= boxOrigin / patternBoxScale;
  v_patternUV *= u_resolution.xy;
  v_patternUV /= u_pixelRatio;
  if (u_fit > 0.) {
    v_patternUV *= (patternBoxNoFitBoxWidth / v_patternBoxSize.x);
  }
  v_patternUV /= u_scale;
  v_patternUV = graphicRotation * v_patternUV;
  v_patternUV += boxOrigin / patternBoxScale;
  v_patternUV -= boxOrigin;
  // x100 is a default multiplier between vertex and fragmant shaders
  // we use it to avoid UV presision issues
  v_patternUV *= .01;

  // ===================================================

  vec2 imageBoxSize;
  if (u_fit == 1.) { // contain
    imageBoxSize.x = min(u_resolution.x / u_imageAspectRatio, u_resolution.y) * u_imageAspectRatio;
  } else if (u_fit == 2.) { // cover
    imageBoxSize.x = max(u_resolution.x / u_imageAspectRatio, u_resolution.y) * u_imageAspectRatio;
  } else {
    imageBoxSize.x = min(10.0, 10.0 / u_imageAspectRatio * u_imageAspectRatio);
  }
  imageBoxSize.y = imageBoxSize.x / u_imageAspectRatio;
  vec2 imageBoxScale = u_resolution.xy / imageBoxSize;

  v_imageUV = uv;
  v_imageUV *= imageBoxScale;
  v_imageUV += boxOrigin * (imageBoxScale - 1.);
  v_imageUV += graphicOffset;
  v_imageUV /= u_scale;
  v_imageUV.x *= u_imageAspectRatio;
  v_imageUV = graphicRotation * v_imageUV;
  v_imageUV.x /= u_imageAspectRatio;

  v_imageUV += .5;
  v_imageUV.y = 1. - v_imageUV.y;
}`;var A=1920*1080*4,p=class{parentElement;canvasElement;gl;program=null;uniformLocations={};fragmentShader;rafId=null;lastRenderTime=0;currentFrame=0;speed=0;currentSpeed=0;providedUniforms;mipmaps=[];hasBeenDisposed=!1;resolutionChanged=!0;textures=new Map;minPixelRatio;maxPixelCount;isSafari=L();uniformCache={};textureUnitMap=new Map;ownerDocument;constructor(e,i,r,n,o=0,a=0,s=2,c=A,h=[]){if(e?.nodeType===1)this.parentElement=e;else throw new Error("Paper Shaders: parent element must be an HTMLElement");if(this.ownerDocument=e.ownerDocument,!this.ownerDocument.querySelector("style[data-paper-shader]")){let d=this.ownerDocument.createElement("style");d.innerHTML=C,d.setAttribute("data-paper-shader",""),this.ownerDocument.head.prepend(d)}let l=this.ownerDocument.createElement("canvas");this.canvasElement=l,this.parentElement.prepend(l),this.fragmentShader=i,this.providedUniforms=r,this.mipmaps=h,this.currentFrame=a,this.minPixelRatio=s,this.maxPixelCount=c;let u=l.getContext("webgl2",n);if(!u)throw new Error("Paper Shaders: WebGL is not supported in this browser");this.gl=u,this.initProgram(),this.setupPositionAttribute(),this.setupUniforms(),this.setUniformValues(this.providedUniforms),this.setupResizeObserver(),visualViewport?.addEventListener("resize",this.handleVisualViewportChange),this.setSpeed(o),this.parentElement.setAttribute("data-paper-shader",""),this.parentElement.paperShaderMount=this,this.ownerDocument.addEventListener("visibilitychange",this.handleDocumentVisibilityChange)}initProgram=()=>{let e=G(this.gl,B,this.fragmentShader);e&&(this.program=e)};setupPositionAttribute=()=>{let e=this.gl.getAttribLocation(this.program,"a_position"),i=this.gl.createBuffer();this.gl.bindBuffer(this.gl.ARRAY_BUFFER,i);let r=[-1,-1,1,-1,-1,1,-1,1,1,-1,1,1];this.gl.bufferData(this.gl.ARRAY_BUFFER,new Float32Array(r),this.gl.STATIC_DRAW),this.gl.enableVertexAttribArray(e),this.gl.vertexAttribPointer(e,2,this.gl.FLOAT,!1,0,0)};setupUniforms=()=>{let e={u_time:this.gl.getUniformLocation(this.program,"u_time"),u_pixelRatio:this.gl.getUniformLocation(this.program,"u_pixelRatio"),u_resolution:this.gl.getUniformLocation(this.program,"u_resolution")};Object.entries(this.providedUniforms).forEach(([i,r])=>{if(e[i]=this.gl.getUniformLocation(this.program,i),r instanceof HTMLImageElement){let n=`${i}AspectRatio`;e[n]=this.gl.getUniformLocation(this.program,n)}}),this.uniformLocations=e};renderScale=1;parentWidth=0;parentHeight=0;parentDevicePixelWidth=0;parentDevicePixelHeight=0;devicePixelsSupported=!1;resizeObserver=null;setupResizeObserver=()=>{this.resizeObserver=new ResizeObserver(([e])=>{if(e?.borderBoxSize[0]){let i=e.devicePixelContentBoxSize?.[0];i!==void 0&&(this.devicePixelsSupported=!0,this.parentDevicePixelWidth=i.inlineSize,this.parentDevicePixelHeight=i.blockSize),this.parentWidth=e.borderBoxSize[0].inlineSize,this.parentHeight=e.borderBoxSize[0].blockSize}this.handleResize()}),this.resizeObserver.observe(this.parentElement)};handleVisualViewportChange=()=>{this.resizeObserver?.disconnect(),this.setupResizeObserver()};handleResize=()=>{let e=0,i=0,r=Math.max(1,window.devicePixelRatio),n=visualViewport?.scale??1;if(this.devicePixelsSupported){let l=Math.max(1,this.minPixelRatio/r);e=this.parentDevicePixelWidth*l*n,i=this.parentDevicePixelHeight*l*n}else{let l=Math.max(r,this.minPixelRatio)*n;if(this.isSafari){let u=I(this.ownerDocument);l*=Math.max(1,u)}e=Math.round(this.parentWidth)*l,i=Math.round(this.parentHeight)*l}let o=Math.sqrt(this.maxPixelCount)/Math.sqrt(e*i),a=Math.min(1,o),s=Math.round(e*a),c=Math.round(i*a),h=s/Math.round(this.parentWidth);(this.canvasElement.width!==s||this.canvasElement.height!==c||this.renderScale!==h)&&(this.renderScale=h,this.canvasElement.width=s,this.canvasElement.height=c,this.resolutionChanged=!0,this.gl.viewport(0,0,this.gl.canvas.width,this.gl.canvas.height),this.render(performance.now()))};render=e=>{if(this.hasBeenDisposed)return;if(this.program===null){console.warn("Tried to render before program or gl was initialized");return}let i=e-this.lastRenderTime;this.lastRenderTime=e,this.currentSpeed!==0&&(this.currentFrame+=i*this.currentSpeed),this.gl.clear(this.gl.COLOR_BUFFER_BIT),this.gl.useProgram(this.program),this.gl.uniform1f(this.uniformLocations.u_time,this.currentFrame*.001),this.resolutionChanged&&(this.gl.uniform2f(this.uniformLocations.u_resolution,this.gl.canvas.width,this.gl.canvas.height),this.gl.uniform1f(this.uniformLocations.u_pixelRatio,this.renderScale),this.resolutionChanged=!1),this.gl.drawArrays(this.gl.TRIANGLES,0,6),this.currentSpeed!==0?this.requestRender():this.rafId=null};requestRender=()=>{this.rafId!==null&&cancelAnimationFrame(this.rafId),this.rafId=requestAnimationFrame(this.render)};setTextureUniform=(e,i)=>{if(!i.complete||i.naturalWidth===0)throw new Error(`Paper Shaders: image for uniform ${e} must be fully loaded`);let r=this.textures.get(e);r&&this.gl.deleteTexture(r),this.textureUnitMap.has(e)||this.textureUnitMap.set(e,this.textureUnitMap.size);let n=this.textureUnitMap.get(e);this.gl.activeTexture(this.gl.TEXTURE0+n);let o=this.gl.createTexture();this.gl.bindTexture(this.gl.TEXTURE_2D,o),this.gl.texParameteri(this.gl.TEXTURE_2D,this.gl.TEXTURE_WRAP_S,this.gl.CLAMP_TO_EDGE),this.gl.texParameteri(this.gl.TEXTURE_2D,this.gl.TEXTURE_WRAP_T,this.gl.CLAMP_TO_EDGE),this.gl.texParameteri(this.gl.TEXTURE_2D,this.gl.TEXTURE_MIN_FILTER,this.gl.LINEAR),this.gl.texParameteri(this.gl.TEXTURE_2D,this.gl.TEXTURE_MAG_FILTER,this.gl.LINEAR),this.gl.texImage2D(this.gl.TEXTURE_2D,0,this.gl.RGBA,this.gl.RGBA,this.gl.UNSIGNED_BYTE,i),this.mipmaps.includes(e)&&(this.gl.generateMipmap(this.gl.TEXTURE_2D),this.gl.texParameteri(this.gl.TEXTURE_2D,this.gl.TEXTURE_MIN_FILTER,this.gl.LINEAR_MIPMAP_LINEAR));let a=this.gl.getError();if(a!==this.gl.NO_ERROR||o===null){console.error("Paper Shaders: WebGL error when uploading texture:",a);return}this.textures.set(e,o);let s=this.uniformLocations[e];if(s){this.gl.uniform1i(s,n);let c=`${e}AspectRatio`,h=this.uniformLocations[c];if(h){let l=i.naturalWidth/i.naturalHeight;this.gl.uniform1f(h,l)}}};areUniformValuesEqual=(e,i)=>e===i?!0:Array.isArray(e)&&Array.isArray(i)&&e.length===i.length?e.every((r,n)=>this.areUniformValuesEqual(r,i[n])):!1;setUniformValues=e=>{this.gl.useProgram(this.program),Object.entries(e).forEach(([i,r])=>{let n=r;if(r instanceof HTMLImageElement&&(n=`${r.src.slice(0,200)}|${r.naturalWidth}x${r.naturalHeight}`),this.areUniformValuesEqual(this.uniformCache[i],n))return;this.uniformCache[i]=n;let o=this.uniformLocations[i];if(!o){console.warn(`Uniform location for ${i} not found`);return}if(r instanceof HTMLImageElement)this.setTextureUniform(i,r);else if(Array.isArray(r)){let a=null,s=null;if(r[0]!==void 0&&Array.isArray(r[0])){let c=r[0].length;if(r.every(h=>h.length===c))a=r.flat(),s=c;else{console.warn(`All child arrays must be the same length for ${i}`);return}}else a=r,s=a.length;switch(s){case 2:this.gl.uniform2fv(o,a);break;case 3:this.gl.uniform3fv(o,a);break;case 4:this.gl.uniform4fv(o,a);break;case 9:this.gl.uniformMatrix3fv(o,!1,a);break;case 16:this.gl.uniformMatrix4fv(o,!1,a);break;default:console.warn(`Unsupported uniform array length: ${s}`)}}else typeof r=="number"?this.gl.uniform1f(o,r):typeof r=="boolean"?this.gl.uniform1i(o,r?1:0):console.warn(`Unsupported uniform type for ${i}: ${typeof r}`)})};getCurrentFrame=()=>this.currentFrame;setFrame=e=>{this.currentFrame=e,this.lastRenderTime=performance.now(),this.render(performance.now())};setSpeed=(e=1)=>{this.speed=e,this.setCurrentSpeed(this.ownerDocument.hidden?0:e)};setCurrentSpeed=e=>{this.currentSpeed=e,this.rafId===null&&e!==0&&(this.lastRenderTime=performance.now(),this.rafId=requestAnimationFrame(this.render)),this.rafId!==null&&e===0&&(cancelAnimationFrame(this.rafId),this.rafId=null)};setMaxPixelCount=(e=A)=>{this.maxPixelCount=e,this.handleResize()};setMinPixelRatio=(e=2)=>{this.minPixelRatio=e,this.handleResize()};setUniforms=e=>{this.setUniformValues(e),this.providedUniforms={...this.providedUniforms,...e},this.render(performance.now())};handleDocumentVisibilityChange=()=>{this.setCurrentSpeed(this.ownerDocument.hidden?0:this.speed)};dispose=()=>{this.hasBeenDisposed=!0,this.rafId!==null&&(cancelAnimationFrame(this.rafId),this.rafId=null),this.gl&&this.program&&(this.textures.forEach(e=>{this.gl.deleteTexture(e)}),this.textures.clear(),this.gl.deleteProgram(this.program),this.program=null,this.gl.bindBuffer(this.gl.ARRAY_BUFFER,null),this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER,null),this.gl.bindRenderbuffer(this.gl.RENDERBUFFER,null),this.gl.bindFramebuffer(this.gl.FRAMEBUFFER,null),this.gl.getError()),this.resizeObserver&&(this.resizeObserver.disconnect(),this.resizeObserver=null),visualViewport?.removeEventListener("resize",this.handleVisualViewportChange),this.ownerDocument.removeEventListener("visibilitychange",this.handleDocumentVisibilityChange),this.uniformLocations={},this.canvasElement.remove(),delete this.parentElement.paperShaderMount}};function F(t,e,i){let r=t.createShader(e);return r?(t.shaderSource(r,i),t.compileShader(r),t.getShaderParameter(r,t.COMPILE_STATUS)?r:(console.error("An error occurred compiling the shaders: "+t.getShaderInfoLog(r)),t.deleteShader(r),null)):null}function G(t,e,i){let r=t.getShaderPrecisionFormat(t.FRAGMENT_SHADER,t.MEDIUM_FLOAT),n=r?r.precision:null;n&&n<23&&(e=e.replace(/precision\s+(lowp|mediump)\s+float;/g,"precision highp float;"),i=i.replace(/precision\s+(lowp|mediump)\s+float/g,"precision highp float").replace(/\b(uniform|varying|attribute)\s+(lowp|mediump)\s+(\w+)/g,"$1 highp $3"));let o=F(t,t.VERTEX_SHADER,e),a=F(t,t.FRAGMENT_SHADER,i);if(!o||!a)return null;let s=t.createProgram();return s?(t.attachShader(s,o),t.attachShader(s,a),t.linkProgram(s),t.getProgramParameter(s,t.LINK_STATUS)?(t.detachShader(s,o),t.detachShader(s,a),t.deleteShader(o),t.deleteShader(a),s):(console.error("Unable to initialize the shader program: "+t.getProgramInfoLog(s)),t.deleteProgram(s),t.deleteShader(o),t.deleteShader(a),null)):null}var C=`@layer paper-shaders {
  :where([data-paper-shader]) {
    isolation: isolate;
    position: relative;

    & canvas {
      contain: strict;
      display: block;
      position: absolute;
      inset: 0;
      z-index: -1;
      width: 100%;
      height: 100%;
      border-radius: inherit;
      corner-shape: inherit;
    }
  }
}`;function L(){let t=navigator.userAgent.toLowerCase();return t.includes("safari")&&!t.includes("chrome")&&!t.includes("android")}function I(t){let e=visualViewport?.scale??1,i=visualViewport?.width??window.innerWidth,r=window.innerWidth-t.documentElement.clientWidth,n=e*i+r,o=outerWidth/n,a=Math.round(100*o);return a%5===0?a/100:a===33?1/3:a===67?2/3:a===133?4/3:o}var b={none:0,contain:1,cover:2};var z=`
#define TWO_PI 6.28318530718
#define PI 3.14159265358979323846
`,M=`
vec2 rotate(vec2 uv, float th) {
  return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
}
`;var P=`
  float hash21(vec2 p) {
    p = fract(p * vec2(0.3183099, 0.3678794)) + 0.1;
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
  }
`;var w={maxColorCount:10},R=`#version 300 es
precision mediump float;

uniform vec4 u_colors[${w.maxColorCount}];
uniform float u_colorsCount;

uniform float u_positions;
uniform float u_waveX;
uniform float u_waveXShift;
uniform float u_waveY;
uniform float u_waveYShift;
uniform float u_mixing;
uniform float u_grainMixer;
uniform float u_grainOverlay;

in vec2 v_objectUV;
out vec4 fragColor;

${z}
${M}
${P}

float valueNoise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  float x1 = mix(a, b, u.x);
  float x2 = mix(c, d, u.x);
  return mix(x1, x2, u.y);
}

float noise(vec2 n, vec2 seedOffset) {
  return valueNoise(n + seedOffset);
}

vec2 getPosition(int i, float t) {
  float a = float(i) * .37;
  float b = .6 + mod(float(i), 3.) * .3;
  float c = .8 + mod(float(i + 1), 4.) * 0.25;

  float x = sin(t * b + a);
  float y = cos(t * c + a * 1.5);

  return .5 + .5 * vec2(x, y);
}

void main() {
  vec2 uv = v_objectUV;
  uv += .5;
  vec2 grainUV = uv * 1000.;

  float grain = noise(grainUV, vec2(0.));
  float mixerGrain = .4 * u_grainMixer * (grain - .5);

  float radius = smoothstep(0., 1., length(uv - .5));
  float center = 1. - radius;
  for (float i = 1.; i <= 2.; i++) {
    uv.x += u_waveX * center / i * cos(TWO_PI * u_waveXShift + i * 2. * smoothstep(.0, 1., uv.y));
    uv.y += u_waveY * center / i * cos(TWO_PI * u_waveYShift + i * 2. * smoothstep(.0, 1., uv.x));
  }

  vec3 color = vec3(0.);
  float opacity = 0.;
  float totalWeight = 0.;
  float positionSeed = 25. + .33 * u_positions;

  for (int i = 0; i < ${w.maxColorCount}; i++) {
    if (i >= int(u_colorsCount)) break;

    vec2 pos = getPosition(i, positionSeed) + mixerGrain;
    float dist = length(uv - pos);
    dist = length(uv - pos);

    vec3 colorFraction = u_colors[i].rgb * u_colors[i].a;
    float opacityFraction = u_colors[i].a;

    float mixing = pow(u_mixing, .7);
    float power = mix(2., 1., mixing);
    dist = pow(dist, power);

    float w = 1. / (dist + 1e-3);
    float baseSharpness = mix(.0, 8., clamp(w, 0., 1.));
    float sharpness = mix(baseSharpness, 1., mixing);
    w = pow(w, sharpness);
    color += colorFraction * w;
    opacity += opacityFraction * w;
    totalWeight += w;
  }

  color /= max(1e-4, totalWeight);
  opacity /= max(1e-4, totalWeight);

  float grainOverlay = valueNoise(rotate(grainUV, 1.) + vec2(3.));
  grainOverlay = mix(grainOverlay, valueNoise(rotate(grainUV, 2.) + vec2(-1.)), .5);
  grainOverlay = pow(grainOverlay, 1.3);

  float grainOverlayV = grainOverlay * 2. - 1.;
  vec3 grainOverlayColor = vec3(step(0., grainOverlayV));
  float grainOverlayStrength = u_grainOverlay * abs(grainOverlayV);
  grainOverlayStrength = pow(grainOverlayStrength, .8);
  color = mix(color, grainOverlayColor, .35 * grainOverlayStrength);

  opacity += .5 * grainOverlayStrength;
  opacity = clamp(opacity, 0., 1.);

  fragColor = vec4(color, opacity);
}
`;function E(t){if(Array.isArray(t))return t.length===4?t:t.length===3?[...t,1]:y;if(typeof t!="string")return y;let e,i,r,n=1;if(t.startsWith("#"))[e,i,r,n]=D(t);else if(t.startsWith("rgb"))[e,i,r,n]=W(t);else if(t.startsWith("hsl"))[e,i,r,n]=X(H(t));else return console.error("Unsupported color format",t),y;return[v(e,0,1),v(i,0,1),v(r,0,1),v(n,0,1)]}function D(t){t=t.replace(/^#/,""),t.length===3&&(t=t.split("").map(o=>o+o).join("")),t.length===6&&(t=t+"ff");let e=parseInt(t.slice(0,2),16)/255,i=parseInt(t.slice(2,4),16)/255,r=parseInt(t.slice(4,6),16)/255,n=parseInt(t.slice(6,8),16)/255;return[e,i,r,n]}function W(t){let e=t.match(/^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([0-9.]+))?\s*\)$/i);return e?[parseInt(e[1]??"0")/255,parseInt(e[2]??"0")/255,parseInt(e[3]??"0")/255,e[4]===void 0?1:parseFloat(e[4])]:[0,0,0,1]}function H(t){let e=t.match(/^hsla?\s*\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*(?:,\s*([0-9.]+))?\s*\)$/i);return e?[parseInt(e[1]??"0"),parseInt(e[2]??"0"),parseInt(e[3]??"0"),e[4]===void 0?1:parseFloat(e[4])]:[0,0,0,1]}function X(t){let[e,i,r,n]=t,o=e/360,a=i/100,s=r/100,c,h,l;if(i===0)c=h=l=s;else{let u=(m,S,f)=>(f<0&&(f+=1),f>1&&(f-=1),f<.16666666666666666?m+(S-m)*6*f:f<.5?S:f<.6666666666666666?m+(S-m)*(.6666666666666666-f)*6:m),d=s<.5?s*(1+a):s+a-s*a,_=2*s-d;c=u(_,d,o+1/3),h=u(_,d,o),l=u(_,d,o-1/3)}return[c,h,l,n]}var v=(t,e,i)=>Math.min(Math.max(t,e),i),y=[0,0,0,1];var N=.35,k=.45,Y=.85,j=.45,$={"google-branding":"Google","ai-mode":"Google","voice-search":"Google","youtube-ai-brand":"YouTube",chirper:"Chirper","peer-payment":"Baton","music-remix":"Baton","baton-branding":"Baton"},O={Google:["#f0edea","#f0edea","#7eb6ff","#7eb6ff","#3d98ff","#1a73e8","#4ec4ff","#c5b8ff","#c5b8ff"],YouTube:["#f0edea","#f0edea","#ff8a8a","#ff8a8a","#ff4d4d","#e60023","#ff7a45","#ffc08a","#ffc08a"],Chirper:["#f0edea","#f0edea","#a8b4ff","#a8b4ff","#6b7cff","#4350e0","#9a7dff","#b8e0ff","#b8e0ff"],Baton:["#f0edea","#f0edea","#7ee0d6","#7ee0d6","#2ec4b6","#0d9488","#5ad4a8","#5ad4a8","#b8ecc0","#b8ecc0"]},q=O.Google;function K(t){let e=2166136261;for(let i=0;i<t.length;i+=1)e^=t.charCodeAt(i),e=Math.imul(e,16777619);return e>>>0}function g(t,e){return(t>>>e&255)/255}function Z(t,e=""){let i=K(e?`${t}:${e}`:t||"work");return{positions:42+g(i,0)*50,waveX:.22+g(i,8)*.55,waveXShift:g(i,16),waveY:.72+g(i,24)*.28,waveYShift:g(i,4)}}function J(t){let e=$[t]||"Google";return O[e]||q}function Q(t,e=""){let i=J(t),r=Z(t,e);return{u_colors:i.map(E),u_colorsCount:i.length,u_positions:r.positions,u_waveX:r.waveX,u_waveXShift:r.waveXShift,u_waveY:r.waveY,u_waveYShift:r.waveYShift,u_mixing:Y,u_grainMixer:N,u_grainOverlay:k,u_fit:b.cover,u_scale:j,u_rotation:0,u_offsetX:0,u_offsetY:0,u_originX:.5,u_originY:.5,u_worldWidth:0,u_worldHeight:0}}var x=new Set;function T(t){let e=new Set([t]),i=t.closest(".project-figure, .project-cover, .project-media");i&&e.add(i),t.parentElement?.classList.contains("media-skeleton")&&e.add(t.parentElement),e.forEach(r=>{r.classList.add("is-loaded"),window.MediaSkeleton?.markLoaded?.(r)})}function ee(t){t&&(t._workGradientShader?.dispose?.(),delete t._workGradientShader,delete t.dataset.workGradientInit,t.querySelectorAll?.("canvas")?.forEach(e=>e.remove()),x.delete(t))}function V(t){if(!t||t.dataset.workGradientInit==="true")return null;t.dataset.workGradientInit="true";let e=t.dataset.slug||"",i=t.dataset.variant||"";try{let r=new p(t,R,Q(e,i),{antialias:!0,alpha:!1,premultipliedAlpha:!0},0,0,2);return t._workGradientShader=r,x.add(t),requestAnimationFrame(()=>{T(t)}),r}catch(r){return delete t.dataset.workGradientInit,console.warn(r),T(t),null}}function U(){document.querySelectorAll("[data-work-gradient]:not([data-work-gradient-init])").forEach(V),queueMicrotask(()=>window.CreamyOrb?.ensureAlive?.())}function te(){[...x].forEach(ee),x.clear(),document.querySelectorAll("[data-work-gradient]").forEach(t=>{t._workGradientShader?.dispose?.(),delete t._workGradientShader,delete t.dataset.workGradientInit})}window.WorkGradients={init:V,initAll:U,disposeAll:te};document.readyState==="loading"?document.addEventListener("DOMContentLoaded",U):U();})();
