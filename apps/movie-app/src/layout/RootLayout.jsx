import { Outlet } from "react-router-dom";
import Nav from "./Nav";
import Footer from "./Footer";

function RootLayout() {
  return (
    <>
      <Nav />

      <main>
        <Outlet />
      </main>

      <Footer />
    </>
  );
}

export default RootLayout;
