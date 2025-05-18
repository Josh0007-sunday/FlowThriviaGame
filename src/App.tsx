import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AdminPage } from "./pages/adminPage";
import { GamePage } from "./pages/gamePage";
import "./config/flow-config";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/" element={<GamePage />} />
      </Routes>
    </Router>
  );
}

export default App;