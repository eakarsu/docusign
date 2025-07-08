-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS docusign_ai;

-- Create logs directory for the application
-- This will be handled by the application, but we can create some initial setup here

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types (these will be created by Prisma migrations)
-- This is just for reference, Prisma will handle the actual schema creation
