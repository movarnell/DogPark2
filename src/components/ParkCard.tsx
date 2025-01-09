import { ParkType } from '../types/ParkType';

function ParkCard({ park, index }: { park: ParkType, index: number }) {
  console.log(park);

  // Parse the amenities string into an array
  const amenitiesArray = JSON.parse(park.amenities);
  console.log(park);

  function determineAmenityColor(amenity: string) {

      switch (true) {
          case "water station" === amenity:
              return "text-gray-900 text-base bg-blue-300 rounded-full my-0.5 px-3 py-1 inline-block";
              break;
          case "adjacent to golf course" === amenity:
              return "text-gray-900 text-base bg-yellow-500 rounded-full my-0.5 px-3 py-1 inline-block";
              break;
          case "separate areas for large and small dogs" === amenity:
              return "text-gray-900 text-base bg-purple-400 rounded-full my-0.5 px-3 py-1 inline-block";
              break;
          case "agility equipment" === amenity:
              return "text-gray-900 text-base bg-red-300 rounded-full my-0.5 px-3 py-1 inline-block";
              break;
          case "water fountains" === amenity:
              return "text-gray-900 text-base bg-blue-200 rounded-full my-0.5 px-3 py-1 inline-block";
              break;
          case "restrooms" === amenity:
              return "text-gray-900 text-base bg-yellow-500 rounded-full my-0.5 px-3 py-1 inline-block";
              break;
          case "scenic trails" === amenity:
              return "text-gray-900 text-base bg-green-200 rounded-full my-0.5 px-3 py-1 inline-block";
          case "water access" === amenity:
              return "text-gray-900 text-base bg-blue-400 rounded-full my-0.5 px-3 py-1 inline-block";
              break;
          case "splash pads" === amenity:
              return "text-gray-900 text-base bg-blue-500 rounded-full my-0.5 px-3 py-1 inline-block";
              break;
          case "playground equipment" === amenity:
              return "text-gray-900 text-base bg-yellow-300 rounded-full my-0.5 px-3 py-1 inline-block";
              break;
          case "training yard" === amenity:
              return "text-gray-900 text-base bg-purple-200 rounded-full my-0.5 px-3 py-1 inline-block";
              break;
          case "shade" === amenity:
              return "text-gray-900 text-base bg-gray-200 rounded-full my-0.5 px-3 py-1 inline-block";
              break;
          case "chairs" === amenity:
              return "text-gray-900 text-base bg-yellow-400 rounded-full my-0.5 px-3 py-1 inline-block";
              break;
          case "doggie bathtub" === amenity:
              return "text-gray-900 text-base bg-pink-200 rounded-full my-0.5 px-3 py-1 inline-block";
              break;
          case "proximity to bike trails" === amenity:
              return "text-gray-900 text-base bg-green-400 rounded-full my-0.5 px-3 py-1 inline-block";
              break;
          case "shade structures" === amenity:
              return "text-gray-900 text-base bg-gray-300 rounded-full my-0.5 px-3 py-1 inline-block";
              break;
          case "play options" === amenity:
              return "text-gray-900 text-base bg-orange-300 rounded-full my-0.5 px-3 py-1 inline-block";
              break;
          case "wrought iron fencing" === amenity:
              return "text-gray-900 text-base bg-teal-300 rounded-full my-0.5 px-3 py-1 inline-block";
              break;
          case "dog station" === amenity:
              return "text-gray-900 text-base bg-rose-400 rounded-full my-0.5 px-3 py-1 inline-block";
              break;
          case "floating boardwalk" === amenity:
              return "text-gray-900 text-base bg-blue-500 rounded-full my-0.5 px-3 py-1 inline-block";
              break;
          case "benches" === amenity:
              return "text-gray-900 text-base bg-amber-500 rounded-full my-0.5 px-3 py-1 inline-block";
              break;
          case "fenced area" === amenity:
              return "text-gray-900 text-base bg-fuchsia-400 rounded-full my-0.5 px-3 py-1 inline-block";
              break;
          case "open space" === amenity:
              return "text-gray-900 text-base bg-green-500 rounded-full my-0.5 px-3 py-1 inline-block";
              break;
          case "walking trails" === amenity:
              return "text-gray-900 text-base bg-green-600 rounded-full my-0.5 px-3 py-1 inline-block";
              break;
          default:
              return "text-gray-900 text-base bg-gray-100 rounded-full my-0.5 px-3 py-1 inline-block";

      }
  }


  return (
    <div key={index} className="p-6 overflow-hidden">
      {/* {park.image_URL && <img className="w-full" src={park.image_URL} alt={park.park_name} />} */}
      <div className="px-6 py-4">
        <h1 className="mb-2 text-2xl font-bold text-balance">{park.park_name}</h1>
        <p className="mt-4 font-bold">About:</p>
        <p className="text-base text-gray-700">{park.notes}</p>
        <p className="text-base text-gray-700">Located in {park.location}.</p>
        <p className="text-base font-bold text-gray-700">Address: </p>
        <p className="text-base text-gray-700">{park.address}</p>
        <p className="text-base text-gray-700"><b>Size:</b> {park.size}</p>
        <p><b>Public:</b> <span className={park.is_public ? "text-green-500" : "text-red-500"}>{park.is_public ? "Public" : "Private"}</span></p>
        <p className="mt-4 font-bold">Park Amenities</p>
        <ul className="list-disc list-inside">
          {amenitiesArray.map((amenity: string, idx: number) => (
            <li key={idx} className={determineAmenityColor(amenity)}>
              {amenity}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default ParkCard;