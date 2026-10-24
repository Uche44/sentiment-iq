-- Schema for the sentiment analysis system.
-- `__DB_NAME__` is substituted with DB_NAME by scripts/db-init.js.

CREATE DATABASE IF NOT EXISTS `__DB_NAME__`;
USE `__DB_NAME__`;

CREATE TABLE IF NOT EXISTS Users (
  userID    INT AUTO_INCREMENT PRIMARY KEY,
  username  VARCHAR(50)  NOT NULL UNIQUE,
  password  VARCHAR(255) NOT NULL,
  role      VARCHAR(20)  NOT NULL DEFAULT 'manager'
);

CREATE TABLE IF NOT EXISTS Products (
  productID   INT AUTO_INCREMENT PRIMARY KEY,
  productName VARCHAR(100) NOT NULL,
  category    VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS Reviews (
  reviewID      INT AUTO_INCREMENT PRIMARY KEY,
  productID     INT NOT NULL,
  customerName  VARCHAR(100),
  reviewText    TEXT NOT NULL,
  dateSubmitted DATETIME NOT NULL,
  FOREIGN KEY (productID) REFERENCES Products(productID),
  INDEX idx_reviews_date (dateSubmitted)
);

CREATE TABLE IF NOT EXISTS SentimentResults (
  resultID       INT AUTO_INCREMENT PRIMARY KEY,
  reviewID       INT NOT NULL UNIQUE,
  sentimentLabel VARCHAR(10) NOT NULL,
  confidenceScore FLOAT NOT NULL,
  dateProcessed  DATETIME NOT NULL,
  FOREIGN KEY (reviewID) REFERENCES Reviews(reviewID) ON DELETE CASCADE,
  CONSTRAINT chk_label CHECK (sentimentLabel IN ('Happy','Angry','Neutral'))
);
