import requests
from bs4 import BeautifulSoup
import csv
import os
import time
import concurrent.futures
from typing import List, Tuple, Optional

def extract_letters_from_puzzle(puzzle_id):
    """Extract letters and panagrams from a single puzzle URL."""
    url = f'https://www.sbsolver.com/s/{puzzle_id}'
    try:
        # Add a small delay to be nice to the server
        time.sleep(0.5)
        
        print(f"Fetching puzzle {puzzle_id}...")
        response = requests.get(url)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Find the div containing the letters
        letters_div = soup.find('div', class_='thinner-space-after')
        if not letters_div:
            print(f"Could not find letters div for puzzle {puzzle_id}")
            return None
            
        # Get all img elements
        img_elements = letters_div.find_all('img')
        if not img_elements:
            print(f"No letter images found for puzzle {puzzle_id}")
            return None
            
        letters = []
        # Process center letter first (has special format)
        center_img = img_elements[0]
        center_alt = center_img.get('alt', '')
        if center_alt.startswith('center letter ') and len(center_alt) > 13:
            center_letter = center_alt[14].upper()
            letters.append(center_letter)
        
        # Process other letters
        for img in img_elements[1:]:
            alt_text = img.get('alt', '')
            if alt_text and len(alt_text) == 1 and alt_text.isalpha():
                letters.append(alt_text.upper())
        
        if len(letters) != 7:
            print(f"Wrong number of letters found ({len(letters)}) for puzzle {puzzle_id}")
            return None
            
        # First letter is center letter
        all_letters = letters[0] + ''.join(sorted(letters[1:]))
        
        # Find panagrams - now checking for all pangram types
        panagrams = []
        pangram_types = ['pangram', 'perfect pangram', 'pangram, disallowed elsewhere']
        for row in soup.find_all('tr'):
            bee_note = row.find('td', class_='bee-note')
            if bee_note and bee_note.string in pangram_types:
                word_cell = row.find('td', class_='bee-hover')
                if word_cell and word_cell.find('a'):
                    # Extract the word, removing any HTML spans
                    word = ''.join(word_cell.find('a').stripped_strings)
                    panagrams.append(word.upper())
        
        print(f"Found letters for puzzle {puzzle_id}: {all_letters}")
        print(f"Found panagrams: {', '.join(panagrams)}")
        return all_letters, panagrams
        
    except requests.exceptions.RequestException as e:
        print(f"Error fetching puzzle {puzzle_id}: {e}")
        return None

def save_to_csv(data, filename='bee_puzzles.csv'):
    # Check if file exists
    file_exists = os.path.isfile(filename)
    
    # Open file in append mode if it exists, write mode if it doesn't
    mode = 'a' if file_exists else 'w'
    with open(filename, mode, newline='') as csvfile:
        writer = csv.writer(csvfile)
        # Write header if creating new file
        if not file_exists:
            writer.writerow(['letters', 'panagrams'])  # Updated header
        # Write data one row per puzzle
        for puzzle_data in data:
            if puzzle_data:
                letters, panagrams = puzzle_data
                if letters and len(letters) >= 7:
                    cleaned_letters = letters.strip().upper()
                    writer.writerow([cleaned_letters, '|'.join(panagrams)])

def scrape_puzzles_parallel(start_id: int, end_id: int, max_workers: int = 10) -> List[Optional[Tuple[str, List[str]]]]:
    """Scrape puzzles in parallel using a thread pool."""
    all_data = []
    
    # Using ThreadPoolExecutor for parallel execution
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit all puzzle IDs to the thread pool
        future_to_puzzle = {executor.submit(extract_letters_from_puzzle, puzzle_id): puzzle_id 
                          for puzzle_id in range(start_id, end_id + 1)}
        
        # Process completed futures as they finish
        for future in concurrent.futures.as_completed(future_to_puzzle):
            puzzle_id = future_to_puzzle[future]
            try:
                puzzle_data = future.result()
                if puzzle_data:
                    all_data.append(puzzle_data)
            except Exception as e:
                print(f"Puzzle {puzzle_id} generated an exception: {e}")
    
    return all_data

if __name__ == '__main__':
    # Get user input for range of puzzles
    while True:
        try:
            start_id = int(input("Enter starting puzzle ID: "))
            end_id = int(input("Enter ending puzzle ID: "))
            if start_id <= 0 or end_id <= 0:
                print("Please enter positive numbers")
                continue
            if end_id < start_id:
                print("Ending ID must be greater than starting ID")
                continue
            break
        except ValueError:
            print("Please enter valid numbers")
    
    print(f"\nStarting to scrape puzzles from {start_id} to {end_id}")
    
    # Calculate optimal number of workers based on puzzle range
    num_puzzles = end_id - start_id + 1
    max_workers = min(20, max(5, num_puzzles // 5))  # Between 5 and 20 workers
    print(f"Using {max_workers} parallel workers for scraping...")
    
    all_data = scrape_puzzles_parallel(start_id, end_id, max_workers)
    
    if all_data:
        filename = f'bee_puzzles_{start_id}_to_{end_id}.csv'
        save_to_csv(all_data, filename)
        print(f"\nSuccessfully extracted {len(all_data)} puzzles!")
        print(f"Saved to {filename}")
    else:
        print("No puzzles were successfully extracted")