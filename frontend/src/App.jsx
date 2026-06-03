import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import DocumentDetail from "./pages/DocumentDetail";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import MfaSetup from "./pages/MfaSetup";
import ForgotPassword from "./pages/ForgotPassword";

import { pdfjs } from 'react-pdf'
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Layout />}>
                    <Route index element={<Home />} />
                    <Route path="documents/:id" element={<DocumentDetail />} />
                    
                </Route>
                <Route path="signin" element={<SignIn />} />
                <Route path="signup" element={<SignUp />} />
                <Route path="mfa-setup" element={<MfaSetup />} />
                <Route path="forgot-password" element={<ForgotPassword />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;