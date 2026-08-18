import * as eventService from '../services/eventService.js';

export async function getEvents(req, res, next) {
  try {
    const result = await eventService.getEvents(req.query);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getEventById(req, res, next) {
  try {
    const result = await eventService.getEventById(req.params.id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function createEvent(req, res, next) {
  try {
    const { title, artist, date, basePrice, venueRef } = req.body;
    const event = await eventService.createEvent({
      title,
      artist,
      date,
      basePrice,
      venueRef,
    });
    return res.status(201).json({ event });
  } catch (error) {
    next(error);
  }
}

export async function updateEvent(req, res, next) {
  try {
    const event = await eventService.updateEvent(req.params.id, req.body);
    return res.status(200).json({ event });
  } catch (error) {
    next(error);
  }
}

export async function deleteEvent(req, res, next) {
  try {
    await eventService.deleteEvent(req.params.id);
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
}
