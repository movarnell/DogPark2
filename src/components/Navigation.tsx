import { Link } from "react-router-dom";
import { HumanType } from "../types/HumanType";

function Navigation({ signedInUser }: { signedInUser: HumanType | null }) {
    return (
        <nav className="p-4 bg-gray-800">
            <div className="container flex items-center justify-between mx-auto">
                <div className="text-lg font-bold text-white">
                    <Link to="/">DogPark</Link>
                </div>
                <div className="flex space-x-4">
                    {signedInUser && (
                        <Link to="/ManageDogs" className="text-white">
                            Manage Dogs
                            </Link>
                            )}
                    <Link to="/parks" className="text-white">
                        Parks
                    </Link>
                    <Link to="/about" className="text-white">
                        About
                    </Link>
                    <Link to="/login" className="text-white">
                        Sign In/Register
                    </Link>
                </div>
            </div>
        </nav>
    );
}

export default Navigation;