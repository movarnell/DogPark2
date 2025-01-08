import { ParkType } from '../types/ParkType';

function ParkCard({ park, index }: { park: ParkType, index: number }) {
  console.log(park);

  // Parse the amenities string into an array
  const amenitiesArray = JSON.parse(park.amenities);
  console.log(amenitiesArray);

  return (
    <div key={index} className="max-w-sm p-6 overflow-hidden">
      {/* {park.image_URL && <img className="w-full" src={park.image_URL} alt={park.park_name} />} */}
      <div className="px-6 py-4">
        <h1 className="mb-2 text-2xl font-bold text-balance">{park.park_name}</h1>
        <p className="mt-4 font-bold">About:</p>
        <p className="text-base text-gray-700">{park.notes}</p>
        <p className="text-base text-gray-700">Located in {park.location}.</p>
        <p className="text-base font-bold text-gray-700">Address: </p>
        <p className="text-base text-gray-700">{park.address}</p>
        <p className="text-base text-gray-700"><b>Size:</b> {park.size}</p>
        <p className="text-base text-gray-700"><b>Public:</b> {park.isPublic ? "Public" : "Private"}</p>
        <p className="mt-4 font-bold">Park Amenities</p>
        <ul className="list-disc list-inside">
          {amenitiesArray.map((amenity: string, idx: number) => (
            <li key={idx} className="text-gray-900 text-base bg-green-300 rounded-full my-0.5 px-3 py-1 inline-block">
              {amenity}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default ParkCard;