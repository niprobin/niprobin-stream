import { Player } from './components/Player'
import { Search } from './components/Search'
import { InstallPrompt } from './components/InstallPrompt'


function App() {
  return (
    <div className="min-h-screen bg-slate-950 pb-32 md:pb-24">
      {/* Main Content Area */}
      <div className="container mx-auto pt-8">
        <h1 className="text-2xl font-bold text-white mb-1 text-center">
          Search and play audio
        </h1>
        <InstallPrompt />
        {/* Search Component */}
        <Search />
      </div>
      
      {/* Player stays at the bottom */}
      <Player />
    </div>
  )
}

export default App