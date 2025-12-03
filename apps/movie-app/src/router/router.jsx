import { createBrowserRouter } from "react-router-dom";
import RootLayout from "../layout/RootLayout";
import MainPage from "../pages/MainPage";

const routes = [
  {
    path: "/",
    element: <RootLayout />,
    children: [{ index: true, element: <MainPage /> }],
  },
];

const router = createBrowserRouter(routes);
export default router;
