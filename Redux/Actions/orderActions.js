import axios from 'axios';
import baseURL from '../../assets/common/baseurl';
import { ORDERS_REQUEST, ORDERS_SUCCESS, ORDERS_FAIL } from '../constants';

export const fetchUserOrders = (userId, token) => {
    return async (dispatch) => {
        dispatch({ type: ORDERS_REQUEST });
        try {
            const response = await axios.get(`${baseURL}orders/user/${userId}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            });
            dispatch({ type: ORDERS_SUCCESS, payload: response.data || [] });
            return response.data || [];
        } catch (error) {
            try {
                const fallback = await axios.get(`${baseURL}orders`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                });
                const filtered = (fallback.data || []).filter(
                    (order) => order.user === userId || (order.user && order.user._id === userId)
                );
                dispatch({ type: ORDERS_SUCCESS, payload: filtered });
                return filtered;
            } catch (fallbackError) {
                const message = fallbackError?.response?.data?.message || fallbackError?.message || 'Failed to load orders';
                dispatch({ type: ORDERS_FAIL, payload: message });
                throw fallbackError;
            }
        }
    };
};
