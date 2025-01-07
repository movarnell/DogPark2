
import './App.css'
import ParkCards from './components/ParkCard'



function App() {
let parks = [
  {
    "id": 1,
    "park_name": "K-9 Corral",
    "location": "Bella Vista, AR",
    "address": "123 Golf Course Rd, Bella Vista, AR 72714",
    "size": "medium",
    "isPublic": true,
    "amenities": ["water station", "adjacent to golf course"],
    "notes": "Located near a golf course; provides water amenities for dogs.",
    "image_URL": "https://example.com/images/k9_corral.jpg"
  },
  {
    "id": 2,
    "park_name": "Bentonville Bark Park",
    "location": "Bentonville, AR",
    "address": "456 Trailhead Dr, Bentonville, AR 72712",
    "size": "large",
    "isPublic": true,
    "amenities": ["separate areas for large and small dogs", "agility equipment", "water fountains", "restrooms"],
    "notes": "Adjacent to Slaughter Pen trail system; offers amenities for both dogs and owners.",
    "image_URL": "https://example.com/images/bentonville_bark_park.jpg"
  },
  {
    "id": 3,
    "park_name": "Lake Atalanta Dog Park",
    "location": "Rogers, AR",
    "address": "789 Lake Atalanta Rd, Rogers, AR 72756",
    "size": "large",
    "isPublic": true,
    "amenities": ["scenic trails", "restrooms", "water access"],
    "notes": "Surrounded by a trail system; provides a picturesque environment for dogs and owners.",
    "image_URL": "https://example.com/images/lake_atalanta_dog_park.jpg"
  },
  {
    "id": 4,
    "park_name": "C.L. Charlie and Willie George Dog Park",
    "location": "Springdale, AR",
    "address": "101 Park St, Springdale, AR 72764",
    "size": "large",
    "isPublic": true,
    "amenities": ["separate areas for large and small dogs", "agility equipment", "splash pads", "playground equipment", "restrooms"],
    "notes": "Part of a larger park with amenities for both dogs and children; includes splash pads and playgrounds.",
    "image_URL": "https://example.com/images/cl_charlie_willie_george_dog_park.jpg"
  },
  {
    "id": 5,
    "park_name": "Iams Dog Park",
    "location": "Fayetteville, AR",
    "address": "202 Dog Park Rd, Fayetteville, AR 72701",
    "size": "3 acres",
    "isPublic": true,
    "amenities": ["separate areas for large and small dogs", "water fountains", "restrooms"],
    "notes": "Features separate fenced areas for different dog sizes; includes water fountains and nearby restrooms.",
    "image_URL": "https://example.com/images/iams_dog_park.jpg"
  },
  {
    "id": 6,
    "park_name": "Murphy Memorial Dog Park",
    "location": "Rogers, AR",
    "address": "303 Memorial Park Dr, Rogers, AR 72758",
    "size": "medium",
    "isPublic": true,
    "amenities": ["separate areas for large and small dogs", "training yard", "shade", "water stations", "chairs", "doggie bathtub"],
    "notes": "Offers multiple sections including a training yard; provides ample shade and a dog wash station.",
    "image_URL": "https://example.com/images/murphy_memorial_dog_park.jpg"
  },
  {
    "id": 7,
    "park_name": "The Railyard Dog Park",
    "location": "Rogers, AR",
    "address": "404 Railyard Park Dr, Rogers, AR 72756",
    "size": "small",
    "isPublic": true,
    "amenities": ["agility equipment", "proximity to bike trails", "restrooms"],
    "notes": "Located near the Railyard Bike Park; features agility equipment and is close to public restrooms.",
    "image_URL": "https://example.com/images/the_railyard_dog_park.jpg"
  },
  {
    "id": 8,
    "park_name": "Orchards Park Dog Park",
    "location": "Bentonville, AR",
    "address": "505 Orchards Park Ln, Bentonville, AR 72712",
    "size": "medium",
    "isPublic": true,
    "amenities": ["separate areas for large and small dogs", "shade structures", "water stations", "play options"],
    "notes": "Adjacent to a children's play area; offers fenced areas for different dog sizes and various play options.",
    "image_URL": "https://example.com/images/orchards_park_dog_park.jpg"
  },
  {
    "id": 9,
    "park_name": "Osage Dog Park",
    "location": "Bentonville, AR",
    "address": "606 Osage Park Dr, Bentonville, AR 72712",
    "size": "medium",
    "isPublic": true,
    "amenities": ["wrought iron fencing", "dog station", "floating boardwalk", "benches"],
    "notes": "Features a floating boardwalk around a lake; provides benches and a dog station for convenience.",
    "image_URL": "https://example.com/images/osage_dog_park.jpg"
  },
  {
    "id": 10,
    "park_name": "Centerton Dog Park",
    "location": "Centerton, AR",
    "address": "707 Dog Park Rd, Centerton, AR 72719",
    "size": "small",
    "isPublic": true,
    "amenities": ["fenced area", "open space"],
    "notes": "Provides a safe, fenced area for dogs to play; offers open space for running.",
    "image_URL": "https://example.com/images/centerton_dog_park.jpg"
  },
  {
    "id": 11,
    "park_name": "Eureka Springs Bark Park",
    "location": "Eureka Springs, AR",
    "address": "808 Bark Park Ln, Eureka Springs, AR 72632",
    "size": "small",
    "isPublic": true,
    "amenities": ["fenced area", "shade"],
    "notes": "Offers a fenced area with shade; suitable for dogs to play and socialize.",
    "image_URL": "https://example.com/images/eureka_springs_bark_park.jpg"
  },
  {
    "id": 12,
    "park_name": "Tails and Trails Dog Park",
    "location": "Siloam Springs, AR",
    "address": "909 Trails End Rd, Siloam Springs, AR 72761",
    "size": "medium",
    "isPublic": true,
    "amenities": ["fenced area", "walking trails", "shade"],
    "notes": "Features a fenced area and walking trails; provides shade for comfort.",
    "image_URL": "https://example.com/images/tails_and_trails_dog_park.jpg"
  }
]

  return (
    <>
    <h1>Dog Parks</h1>
     <div className="container mx-auto">
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {parks.map((park, index) => (
        <ParkCards key={index} park={park} index={index} />
      ))}
    </div>
  </div>
    </>
  )
}

export default App
