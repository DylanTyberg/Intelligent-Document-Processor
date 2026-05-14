import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
// import DocumentDetail from "./pages/DocumentDetail";

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Layout />}>
                    <Route index element={<Home />} />
                    {/* <Route path="documents/:id" element={<DocumentDetail />} /> */}
                </Route>
            </Routes>
        </BrowserRouter>
    );
}

export default App;