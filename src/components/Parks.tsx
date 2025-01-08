import { ParkType } from "../types/ParkType"


function Parks({ parks }: { parks: ParkType[] }) {
    return (
        <div>
            {parks.map((park: ParkType) => (
                <div key={park.id} className="p-4">
                    <h2>{park.park_name}</h2>
                    <p>This park is in {park.location}</p>
                    <p>The address: </p>
                    <p>{park.address}</p>
                    <p>Size: {park.size}</p>
                    <p>Public: <span className={park.is_public ? "text-red-600": "text-green-500"}> {park.is_public ? "Public" : "Private"}</span></p>
                    {/* <p>{park.amenities}</p> */}
                    <p>{park.notes}</p>

        </div>
            ))}
        </div>
    );
}

export default Parks;