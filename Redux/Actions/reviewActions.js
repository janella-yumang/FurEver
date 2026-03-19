import axios from 'axios';
import baseURL from '../../assets/common/baseurl';
import { REVIEWS_REQUEST, REVIEWS_SUCCESS, REVIEWS_FAIL } from '../constants';

export const fetchProductReviews = (productId) => {
    return async (dispatch) => {
        const normalizedId = String(productId || '');
        dispatch({ type: REVIEWS_REQUEST, payload: { productId: normalizedId } });
        try {
            const response = await axios.get(`${baseURL}products/${normalizedId}/reviews`);
            dispatch({
                type: REVIEWS_SUCCESS,
                payload: { productId: normalizedId, reviews: response.data || [] },
            });
            return response.data || [];
        } catch (error) {
            const message = error?.response?.data?.message || error?.message || 'Failed to load reviews';
            dispatch({
                type: REVIEWS_FAIL,
                payload: { productId: normalizedId, error: message },
            });
            throw error;
        }
    };
};
