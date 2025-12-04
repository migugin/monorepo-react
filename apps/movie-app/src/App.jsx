import { RouterProvider } from "react-router-dom";
import router from "./router/router";
import "@/style/App.scss";

function App() {
  return (
    <div className="app">
      <RouterProvider router={router} />
    </div>
  );
}

export default App;
