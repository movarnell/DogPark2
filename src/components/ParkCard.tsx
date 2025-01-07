import { ParkType } from '../types/ParkType';


function ParkCard({park, index}: {park: ParkType, index: number}) {


  return (
    <div key={index} className="max-w-sm overflow-hidden p-6">
      {/* {park.image_URL && <img className="w-full" src={park.image_URL} alt={park.park_name} />} */}
      <div className="px-6 py-4">
        <h1 className="font-bold text-2xl text-balance mb-2">{park.park_name}</h1>
          <p className="font-bold mt-4">About:</p>
          <p className="text-gray-700 text-base">{park.notes}</p>
        <p className="text-gray-700 text-base">Located in {park.location}.</p>
        <p className="text-gray-700 text-base font-bold">Address: </p>
        <p className="text-gray-700 text-base">{park.address}</p>
        <p className="text-gray-700 text-base"><b>Size:</b> {park.size}</p>
        <p className="text-gray-700 text-base"><b>Public:</b> {park.isPublic ? "Public" : "Private"}</p>
        <p className="font-bold mt-4">Park Amenities</p>
        <ul className="list-disc list-inside">
          {park.amenities.map((amenity, index) => (
            <li key={index} className="text-gray-900 text-base bg-green-300 rounded-full my-0.5 px-3 py-1 inline-block">{amenity}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default ParkCard;