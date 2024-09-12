const config = {
  rotationDelay: 0,
  scaleFactor: 1.8,
  degPerSec: 6,
  angles: { x: -100, y: -20, z: 0 },
  colors: {
      water: '#F2F5F6',
      land: '#DBDBDB',

  },
  animationDuration: 2000, // Duration of the fade animation in milliseconds
  animationDelay: 1000 // Delay between each country's color animation
};
const state = {
  currentCountry: null,
  lastTime: d3.now(),
  degPerMs: config.degPerSec / 1000,
  isDragging: false,
  startX: 0,
  startY: 0,
  saudiArabia: null,
  highlightedCountries: [] // Store highlighted countries for animation
};
const elements = {
  countryLabel: d3.select('#countryLabel'),
  canvas: d3.select('#globe'),
  context: d3.select('#globe').node().getContext('2d')
};
const projection = d3.geoOrthographic().precision(0.1);
const path = d3.geoPath(projection).context(elements.context);
let autorotate, land, countries, countryList;
const setAngles = () => {
  const rotation = projection.rotate();
  rotation[0] = config.angles.x;
  rotation[1] = config.angles.y;
  rotation[2] = config.angles.z;
  projection.rotate(rotation);
};
const scale = () => {
  const width = document.documentElement.clientWidth * config.scaleFactor;
  const height = document.documentElement.clientHeight * config.scaleFactor;
  elements.canvas.attr('width', width).attr('height', height);
  projection
    .scale(Math.min(width, height) / 2)
    .translate([width / 2, height / 2]);
  render();
};
const startRotation = (delay) => {
  autorotate.restart(rotate, delay || 0);
};
const dragstarted = (event) => {
  state.isDragging = true;
  state.startX = event.x;
  state.startY = event.y;
  autorotate.stop();
};
const dragged = (event) => {
  if (!state.isDragging) { return } ;
  const sensitivity = 0.25; // Adjust the sensitivity of rotation
  const dx = (event.x - state.startX) * sensitivity;
  const dy = (event.y - state.startY) * sensitivity;
  state.startX = event.x;
  state.startY = event.y;
  const rotation = projection.rotate();
  rotation[0] += dx;
  rotation[1] -= dy;
  projection.rotate(rotation);
  render();
};
const dragended = () => {
  state.isDragging = false;
  startRotation(config.rotationDelay);
};
const render = () => {
  const { context } = elements;
  const width = document.documentElement.clientWidth;
  const height = document.documentElement.clientHeight;
  context.clearRect(0, 0, width, height);
  fill({ type: 'Sphere' }, config.colors.water);
  fill(land, config.colors.land);
  if (state.saudiArabia) {
      elements.countryLabel.style('color', config.colors.saudiArabia)
      fill(state.saudiArabia, config.colors.saudiArabia);
  }
  if (state.currentCountry && state.currentCountry !== state.saudiArabia) {
      elements.countryLabel.style('color', 'white')
      fill(state.currentCountry, config.colors.hover);
  }
};
const fill = (obj, color, alpha = 1) => {
  elements.context.beginPath();
  path(obj);
  elements.context.fillStyle = color;
  elements.context.globalAlpha = alpha;
  elements.context.fill();
  elements.context.globalAlpha = 1; // Reset alpha
};
const rotate = (elapsed) => {
  const now = d3.now();
  const diff = now - state.lastTime;
  if (diff < elapsed) {
      const rotation = projection.rotate();
      rotation[0] += diff * state.degPerMs;
      projection.rotate(rotation);
      render();
  }
  state.lastTime = now;
};
const loadData = async (cb) => {
  const world = await d3.json('https://unpkg.com/world-atlas@2.0.2/countries-110m.json');
  let countryNames = await d3.tsv('https://gist.githubusercontent.com/mbostock/4090846/raw/07e73f3c2d21558489604a0bc434b3a5cf41a867/world-country-names.tsv');
  countryNames[110].name = "Palestine"
  cb(world, countryNames);
};
const getCountry = (event) => {
  const pos = projection.invert(d3.pointer(event));
  return countries.features.find((f) =>
      f.geometry.coordinates.find((c1) =>
      d3.polygonContains(c1, pos) || c1.some((c2) => d3.polygonContains(c2, pos))
      )
  );
};
const mousemove = (event) => {
  const country = getCountry(event);
  if (!country) {
      if (state.currentCountry) {
          leave(state.currentCountry);
          state.currentCountry = null;
          render();
      }
      return;
  }
  if (country === state.currentCountry) {
      return;
  }
  state.currentCountry = country;
  render();
  enter(country);
};
const enter = (country) => {
  const name = countryList.find((c) => parseInt(c.id) === parseInt(country.id))?.name || '';
  elements.countryLabel.text(name);
  
  // Start the color animation for the country
  animateCountryColor(country);
};
const leave = (country) => {
  elements.countryLabel.text('');
  
  // Stop the color animation for the country
  stopAnimatingCountryColor(country);
};
const animateCountryColor = (country) => {
  const { context } = elements;
  const fillColor = config.colors.highlight;
  const originalColor = config.colors.land;
  
  state.highlightedCountries.push(country);
  d3.transition()
    .duration(config.animationDuration)
    .ease(d3.easeLinear)
    .tween('color', () => {
      const interpolate = d3.interpolateRgb(originalColor, fillColor);
      return (t) => {
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        render();
        fill(country, interpolate(t), 1 - t); // Fading out
      };
    })
    .transition()
    .duration(config.animationDuration)
    .ease(d3.easeLinear)
    .tween('color', () => {
      const interpolate = d3.interpolateRgb(fillColor, originalColor);
      return (t) => {
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        render();
        fill(country, interpolate(t), t); // Fading in
      };
    });
};
const stopAnimatingCountryColor = (country) => {
  state.highlightedCountries = state.highlightedCountries.filter(c => c !== country);
};
const init = () => {
  setAngles();
  elements.canvas.call(
      d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended)
  ).on('mousemove', mousemove).on('touchmove', mousemove);
  loadData((world, cList) => {
      land = topojson.feature(world, world.objects.land);
      countries = topojson.feature(world, world.objects.countries);
      countryList = cList;
      state.saudiArabia = countries.features.find(country => {
          const countryData = countryList.find(c => parseInt(c.id, 10) === parseInt(country.id, 10));
          return countryData && countryData.name === 'Saudi Arabia';
      });
      window.addEventListener('resize', scale);
      scale();
      autorotate = d3.timer(rotate);
  });
};
init();
// Nav button color change
document.addEventListener('scroll', function() {
  const button = document.querySelector('.nav-prime-btn');
  if (window.scrollY > window.innerHeight * 0.6) {
      button.classList.add('scrolled');
  } else {
      button.classList.remove('scrolled');
  }
});
// -------------- Marquee
function startMarquee() {
  const marqueeInner = document.querySelector('.marquee-inner');
  const marqueeContent = document.querySelectorAll('.marquee-content');
  const contentWidth = marqueeContent[0].offsetWidth;
  let offset = 0;
  const speed = 0.25; // Adjust this value to control the speed
  // Clone the first content block to ensure smooth looping
  const firstClone = marqueeContent[0].cloneNode(true);
  marqueeInner.appendChild(firstClone);
  function animateMarquee() {
      offset -= speed;
      if (Math.abs(offset) >= contentWidth) {
          offset = 0;
      }
      marqueeInner.style.transform = `translateX(${offset}px)`;
      requestAnimationFrame(animateMarquee);
  }
  animateMarquee();
}
// Initialize marquee on window load
window.addEventListener('load', startMarquee);
// Make layer interactive
function enableInteraction() {
  const overlay = document.getElementById('overlay-layer');
  overlay.style.pointerEvents = 'none'; // Make the overlay transparent to pointer events
}
function disableInteraction() {
  const overlay = document.getElementById('overlay-layer');
  overlay.style.pointerEvents = 'auto'; // Prevent interaction with the underlying elements
}
// Call `enableInteraction()` to allow interaction with the elements beneath the overlay
// Call `disableInteraction()` to block interaction with the elements beneath the overlay







