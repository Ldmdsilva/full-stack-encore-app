import * as venueService from '../services/venueService.js';

export async function getAllVenues(req, res, next) {
  try {
    const venues = await venueService.getAllVenues();
    return res.status(200).json({ venues });
  } catch (error) {
    next(error);
  }
}

export async function getVenueById(req, res, next) {
  try {
    const venue = await venueService.getVenueById(req.params.id);
    return res.status(200).json({ venue });
  } catch (error) {
    next(error);
  }
}

export async function createVenue(req, res, next) {
  try {
    const { name, address, seatLayout } = req.body;
    const venue = await venueService.createVenue({ name, address, seatLayout });
    return res.status(201).json({ venue });
  } catch (error) {
    next(error);
  }
}

export async function updateVenue(req, res, next) {
  try {
    const venue = await venueService.updateVenue(req.params.id, req.body);
    return res.status(200).json({ venue });
  } catch (error) {
    next(error);
  }
}

export async function deleteVenue(req, res, next) {
  try {
    await venueService.deleteVenue(req.params.id);
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
}
