import * as fcl from "@onflow/fcl";
import { useCurrentUser } from "../../hooks/useCurrentUser";

export function WalletButton() {
  const { user, isLoading } = useCurrentUser();

  if (isLoading) return (
    <div className="px-6 py-2 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 text-white animate-pulse">
      Loading...
    </div>
  );

  const address = user?.addr || '';

  return (
    <div>
      {user?.loggedIn ? (
        <div className="flex items-center gap-4">
          <div className="px-4 py-2 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 text-white">
            <span className="text-sm">Adventurer: {address.slice(0, 6)}...{address.slice(-4)}</span>
          </div>
          <button 
            onClick={fcl.unauthenticate}
            className="px-6 py-2 bg-red-500/80 hover:bg-red-600 text-white rounded-lg transition-all duration-300 transform hover:scale-105 border border-red-400/50 shadow-lg hover:shadow-red-500/20"
          >
            Leave Quest
          </button>
        </div>
      ) : (
        <button
          onClick={fcl.logIn}
          className="px-6 py-2 bg-yellow-500/80 hover:bg-yellow-600 text-white rounded-lg transition-all duration-300 transform hover:scale-105 border border-yellow-400/50 shadow-lg hover:shadow-yellow-500/20 font-medium"
        >
          Begin Adventure
        </button>
      )}
    </div>
  );
}