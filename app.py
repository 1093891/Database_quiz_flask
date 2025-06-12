import csv
from flask import Flask, render_template, jsonify, request
import os
import random  # Import random for shuffling

app = Flask(__name__)


# Function to parse questions from CSV
def load_questions_from_csv(file_path):
    questions = []
    # Using 'utf-8' encoding is standard. If you face issues, try 'latin-1' or specify the correct encoding.
    with open(file_path, 'r', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        for i, row in enumerate(reader):  # Add enumeration to get line number for debugging
            line_num = i + 2  # +1 for 0-index, +1 for header row
            try:
                # Basic validation for essential fields before processing
                if not all(key in row for key in ['id', 'type', 'difficulty', 'question', 'explanation']):
                    raise KeyError(
                        "Missing one or more required columns (id, type, difficulty, question, explanation).")

                question_data = {
                    "id": row['id'],
                    "type": row['type'],
                    "difficulty": row['difficulty'],
                    "question": row['question'],
                    "explanation": row['explanation']
                }

                if row['type'] == 'mcq':
                    if not row['options']:
                        raise ValueError("MCQ question has an empty 'options' field.")
                    question_data['options'] = row['options'].split('|')
                    try:
                        question_data['correctAnswerIndex'] = int(row['correct_answer'])
                    except ValueError:
                        raise ValueError("MCQ 'correct_answer' is not a valid integer index.")
                elif row['type'] == 'true_false':
                    # 'correct_answer' can be 'true' or 'false' (string)
                    correct_ans_str = row['correct_answer'].strip().lower()
                    if correct_ans_str not in ('true', 'false'):
                        raise ValueError("True/False 'correct_answer' must be 'true' or 'false'.")
                    question_data['correctAnswer'] = correct_ans_str == 'true'
                elif row['type'] == 'drag_drop':
                    if not row['options']:
                        raise ValueError("Drag-and-drop question has an empty 'options' field.")

                    parts = row['options'].split(';')
                    if len(parts) != 3:
                        raise ValueError(
                            f"Drag-and-drop question 'options' field malformed. Expected 3 parts separated by ';', got {len(parts)}.")

                    # Helper to parse sub-items like "id:text|id:text"
                    def parse_id_text_list(raw_list_str, field_name):
                        parsed_items = []
                        if not raw_list_str:  # Handle case of empty sub-list
                            return parsed_items
                        for item_str in raw_list_str.split('|'):
                            if ':' not in item_str:
                                raise ValueError(
                                    f"Drag-and-drop '{field_name}' item '{item_str}' is malformed. Missing ':'.")
                            item_id, item_text = item_str.split(':', 1)
                            if not item_id or not item_text:  # Basic check for empty ID/text
                                raise ValueError(
                                    f"Drag-and-drop '{field_name}' item '{item_str}' has empty ID or text.")
                            parsed_items.append({"id": item_id, "text": item_text})
                        return parsed_items

                    # Parse draggable items
                    question_data['draggableItems'] = parse_id_text_list(parts[0], 'draggable_items')

                    # Parse droppable targets
                    question_data['droppableTargets'] = parse_id_text_list(parts[1], 'droppable_targets')

                    # Parse correct mapping
                    correct_mapping_raw = parts[2]
                    question_data['correctMapping'] = {}
                    if not correct_mapping_raw:  # Handle empty mapping list
                        raise ValueError("Drag-and-drop 'correctMapping' field is empty.")
                    for mapping_str in correct_mapping_raw.split('|'):
                        if ':' not in mapping_str:
                            raise ValueError(f"Drag-and-drop mapping '{mapping_str}' is malformed. Missing ':'.")
                        draggable_id, droppable_id = mapping_str.split(':', 1)
                        if not draggable_id or not droppable_id:  # Basic check for empty ID/target ID
                            raise ValueError(
                                f"Drag-and-drop mapping '{mapping_str}' has empty draggable or droppable ID.")
                        question_data['correctMapping'][draggable_id] = droppable_id

                questions.append(question_data)
            except KeyError as e:
                print(f"Error: Missing column '{e}' in row {line_num} of questions.csv. Row: {row}")
                # Continue to next row even if a column is missing
                continue
            except ValueError as e:
                print(f"Error parsing question on line {line_num} (ID: {row.get('id', 'N/A')}): {e}. Row: {row}")
                # Continue to next row for malformed data
                continue
            except Exception as e:
                # Catch any other unexpected error during row processing
                print(f"Unexpected error processing row {line_num} (ID: {row.get('id', 'N/A')}): {e}. Row: {row}")
                continue
    return questions


# Get the directory of the current script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
QUESTIONS_FILE = os.path.join(BASE_DIR, 'questions.csv')

# Load questions once when the app starts
try:
    ALL_QUIZ_QUESTIONS = load_questions_from_csv(QUESTIONS_FILE)
    if not ALL_QUIZ_QUESTIONS:
        print("\n--- WARNING ---")
        print("No questions were loaded from questions.csv. This could be due to:")
        print("1. The file does not exist at the expected path: %s" % QUESTIONS_FILE)
        print("2. The file is empty or contains only headers.")
        print(
            "3. All questions in the file had critical parsing errors (see above 'Error parsing question' messages).\n")
except FileNotFoundError:
    print(f"\n--- CRITICAL ERROR ---")
    print(f"questions.csv not found at {QUESTIONS_FILE}.")
    print("Please ensure the 'questions.csv' file is in the same directory as 'app.py'.\n")
    ALL_QUIZ_QUESTIONS = []  # Initialize as empty to prevent app crash
except Exception as e:  # Catch any other unexpected error during file opening or initial setup
    print(f"\n--- CRITICAL ERROR during initial loading of questions.csv: {e} ---\n")
    ALL_QUIZ_QUESTIONS = []


@app.route('/')
def index():
    """Renders the main quiz application page."""
    return render_template('index.html')


@app.route('/api/questions')
def get_questions():
    """
    Returns a subset of quiz questions based on the requested number.
    Shuffles questions before returning.
    """
    num_questions_str = request.args.get('count', type=str)

    if not ALL_QUIZ_QUESTIONS:
        # If questions were not loaded successfully during startup, return a 500 error here.
        return jsonify(
            {"error": "No questions loaded. Check server logs for specific parsing errors during startup."}), 500

    if num_questions_str and num_questions_str.isdigit():
        num_questions = int(num_questions_str)
        if num_questions <= 0:
            return jsonify({"error": "Number of questions must be positive."}), 400

        # Shuffle questions and select the requested number
        shuffled_questions = random.sample(ALL_QUIZ_QUESTIONS, min(num_questions, len(ALL_QUIZ_QUESTIONS)))
        return jsonify(shuffled_questions)
    else:
        # If no count specified, return all questions
        return jsonify(ALL_QUIZ_QUESTIONS)


if __name__ == '__main__':
    # Ensure the static and templates directories exist for Flask to find them
    # These are usually created manually or by a build script, but good for robustness
    os.makedirs(os.path.join(BASE_DIR, 'templates'), exist_ok=True)
    os.makedirs(os.path.join(BASE_DIR, 'static', 'css'), exist_ok=True)
    os.makedirs(os.path.join(BASE_DIR, 'static', 'js'), exist_ok=True)
    app.run(debug=True)
