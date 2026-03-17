import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from './Layout';
import Spinner from './Spinner';

export default function PrivateRoute() {
  const { isAuth, loading } = useAuth();

  if (loading) return <Spinner fullscreen />;
  if (!isAuth) return <Navigate to="/login" replace />;

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}
