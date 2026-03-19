import axios from 'axios';
import baseURL from '../../assets/common/baseurl';
import { PRODUCTS_REQUEST, PRODUCTS_SUCCESS, PRODUCTS_FAIL } from '../constants';

export const fetchProducts = () => {
    return async (dispatch) => {
        dispatch({ type: PRODUCTS_REQUEST });
        try {
            const response = await axios.get(`${baseURL}products`);
            dispatch({ type: PRODUCTS_SUCCESS, payload: response.data || [] });
            return response.data || [];
        } catch (error) {
            const message = error?.response?.data?.message || error?.message || 'Failed to load products';
            dispatch({ type: PRODUCTS_FAIL, payload: message });
            throw error;
        }
    };
};
