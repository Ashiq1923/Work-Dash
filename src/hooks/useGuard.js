import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

/**
 * Returns a guard function. Call guard() before any mutation.
 * If not logged in, shows toast and redirects to login. Returns false.
 * If logged in, returns true.
 */
export function useGuard() {
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();

  const guard = () => {
    if (isLoggedIn) return true;
    toast.error('Please login to perform this action');
    navigate('/login');
    return false;
  };

  return { guard, isLoggedIn };
}
