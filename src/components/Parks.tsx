import { ParkType } from "../types/ParkType"
import ParkCard from "./ParkCard";


function Parks({ parks }: { parks: ParkType[] }) {
    return (
        <div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">

            {parks.map((park, index) => (
                <ParkCard key={index} park={park} index={index} />
            ))}
            </div>
        </div>

    )
}

export default Parks;